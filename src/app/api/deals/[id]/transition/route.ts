import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

import { calcSettlement } from "@/lib/settlement";

const TransitionSchema = z.object({
  targetStatus: z.enum(["NOT_ALLOTTED", "ALLOTTED", "SOLD", "SETTLED"]),
  salePrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  sharedProfitBasis: z.enum(["OWN_SHARE", "TOTAL_PROFIT"]).optional(),
  carryForward: z.boolean().optional(), // if true, skip REFUND on NOT_ALLOTTED
});

// Valid forward-only state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ["NOT_ALLOTTED", "ALLOTTED"],
  ALLOTTED: ["SOLD"],
  SOLD: ["SETTLED"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = TransitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { targetStatus, salePrice, sharedProfitBasis, carryForward } = parsed.data;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { friend: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Enforce forward-only state machine
  const validNext = VALID_TRANSITIONS[deal.status] ?? [];
  if (!validNext.includes(targetStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${deal.status} to ${targetStatus}`,
        validTransitions: validNext,
      },
      { status: 400 }
    );
  }

  // Handle each transition
  if (targetStatus === "NOT_ALLOTTED") {
    if (carryForward) {
      // CARRY FORWARD: money stays in friend's account for next IPO — no REFUND entry
      await prisma.deal.update({
        where: { id },
        data: { status: "NOT_ALLOTTED", carryForward: true },
      });
      return NextResponse.json({ ok: true, status: "NOT_ALLOTTED", carryForward: true });
    }

    // NORMAL REFUND: money comes back to you
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({ where: { id }, data: { status: "NOT_ALLOTTED", carryForward: false } });

      // Refund mayank's contribution back to Mayank
      await tx.ledgerEntry.create({
        data: {
          friendId: deal.friendId,
          dealId: id,
          type: "REFUND",
          amount: deal.mayankContribution,
          direction: "FROM_FRIEND",
          note: `Refund received — ${deal.ipoName} not allotted`,
        },
      });
    });

    return NextResponse.json({ ok: true, status: "NOT_ALLOTTED", carryForward: false });
  }

  if (targetStatus === "ALLOTTED") {
    await prisma.deal.update({ where: { id }, data: { status: "ALLOTTED" } });
    return NextResponse.json({ ok: true, status: "ALLOTTED" });
  }

  if (targetStatus === "SOLD") {
    if (!salePrice) {
      return NextResponse.json(
        { error: "salePrice is required when marking a deal as SOLD" },
        { status: 400 }
      );
    }

    const salePriceDecimal = new Decimal(salePrice);
    const totalInvested = deal.mayankContribution.add(deal.friendContribution);

    if (salePriceDecimal.lte(0)) {
      return NextResponse.json(
        { error: "salePrice must be greater than 0" },
        { status: 400 }
      );
    }

    // If sharedProfitBasis is being set at this point, update it
    const updateData: Record<string, unknown> = {
      status: "SOLD",
      salePrice: salePriceDecimal,
    };

    if (sharedProfitBasis && deal.fundingType === "SHARED") {
      updateData.sharedProfitBasis = sharedProfitBasis;
    }

    await prisma.deal.update({ where: { id }, data: updateData });
    return NextResponse.json({ ok: true, status: "SOLD" });
  }

  if (targetStatus === "SETTLED") {
    if (!deal.salePrice) {
      return NextResponse.json(
        { error: "salePrice must be set before settling" },
        { status: 400 }
      );
    }

    // Optionally set sharedProfitBasis if provided now
    let effectiveBasis = deal.sharedProfitBasis;
    if (sharedProfitBasis && deal.fundingType === "SHARED") {
      effectiveBasis = sharedProfitBasis;
    }

    // SHARED_BASIS_REQUIRED guard — never guess
    if (deal.fundingType === "SHARED" && !effectiveBasis) {
      return NextResponse.json(
        {
          error: "SHARED_BASIS_REQUIRED",
          message:
            "This SHARED deal has no sharedProfitBasis set. Please choose OWN_SHARE or TOTAL_PROFIT before settling.",
        },
        { status: 409 }
      );
    }

    // Calculate settlement using the profit-settlement skill formulas
    let settlement;
    try {
      settlement = calcSettlement({
        fundingType: deal.fundingType,
        mayankContribution: deal.mayankContribution,
        friendContribution: deal.friendContribution,
        salePrice: deal.salePrice,
        profitPct: deal.profitPct,
        sharedProfitPct: deal.sharedProfitPct,
        sharedProfitBasis: effectiveBasis,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Calculation error";
      if (msg === "SHARED_BASIS_REQUIRED") {
        return NextResponse.json(
          { error: "SHARED_BASIS_REQUIRED" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Verify reconciliation: friendPayout + mayankPayout === salePrice
    const reconciled = settlement.friendPayout.add(settlement.mayankPayout);
    if (!reconciled.eq(deal.salePrice)) {
      return NextResponse.json(
        {
          error: "Settlement reconciliation failed",
          salePrice: deal.salePrice.toString(),
          computed: reconciled.toString(),
        },
        { status: 500 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Update deal status and sharedProfitBasis if changed
      await tx.deal.update({
        where: { id },
        data: {
          status: "SETTLED",
          ...(effectiveBasis !== deal.sharedProfitBasis
            ? { sharedProfitBasis: effectiveBasis }
            : {}),
        },
      });

      // Mayank's payout (capital + profit) comes back FROM_FRIEND
      await tx.ledgerEntry.create({
        data: {
          friendId: deal.friendId,
          dealId: id,
          type: "SETTLEMENT",
          amount: settlement.mayankPayout,
          direction: "FROM_FRIEND",
          note: `Settlement return — ${deal.ipoName} (payout to you)`,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      status: "SETTLED",
      friendPayout: settlement.friendPayout.toString(),
      mayankPayout: settlement.mayankPayout.toString(),
      totalProfit: settlement.totalProfit.toString(),
    });
  }

  return NextResponse.json({ error: "Unhandled transition" }, { status: 400 });
}
