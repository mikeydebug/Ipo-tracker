import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";


const CreateDealSchema = z.object({
  ipoName: z.string().min(1).max(200),
  applyDate: z.string().datetime(),
  allotmentDate: z.string().datetime().optional().nullable(),
  listingDate: z.string().datetime().optional().nullable(),
  friendId: z.string().cuid(),
  fundingType: z.enum(["FULL", "SHARED"]),
  lots: z.number().int().positive().optional().nullable(),
  mayankContribution: z.string().regex(/^\d+(\.\d+)?$/),
  friendContribution: z.string().regex(/^\d+(\.\d+)?$/),
  profitPct: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  sharedProfitPct: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  sharedProfitBasis: z.enum(["OWN_SHARE", "TOTAL_PROFIT"]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get("friendId");
  const status = searchParams.get("status");

  const deals = await prisma.deal.findMany({
    where: {
      ...(friendId ? { friendId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { applyDate: "desc" },
    include: {
      friend: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    deals.map((d) => ({
      ...d,
      mayankContribution: d.mayankContribution.toString(),
      friendContribution: d.friendContribution.toString(),
      profitPct: d.profitPct?.toString() ?? null,
      sharedProfitPct: d.sharedProfitPct?.toString() ?? null,
      salePrice: d.salePrice?.toString() ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateDealSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate funding type constraints
  const mayankAmt = new Decimal(data.mayankContribution);
  const friendAmt = new Decimal(data.friendContribution);

  if (mayankAmt.lte(0)) {
    return NextResponse.json(
      { error: "mayankContribution must be > 0" },
      { status: 400 }
    );
  }

  if (data.fundingType === "FULL" && !friendAmt.eq(0)) {
    return NextResponse.json(
      { error: "friendContribution must be 0 for FULL deals" },
      { status: 400 }
    );
  }

  if (data.fundingType === "SHARED" && friendAmt.lte(0)) {
    return NextResponse.json(
      { error: "friendContribution must be > 0 for SHARED deals" },
      { status: 400 }
    );
  }

  // Verify the friend exists and get defaultProfitPct
  const friend = await prisma.friend.findUnique({ where: { id: data.friendId } });
  if (!friend) {
    return NextResponse.json({ error: "Friend not found" }, { status: 404 });
  }

  // For FULL deals, fall back to friend's defaultProfitPct if profitPct not set
  const profitPct =
    data.profitPct != null
      ? new Decimal(data.profitPct)
      : data.fundingType === "FULL"
      ? friend.defaultProfitPct
      : null;

  const deal = await prisma.$transaction(async (tx) => {
    const newDeal = await tx.deal.create({
      data: {
        ipoName: data.ipoName,
        applyDate: new Date(data.applyDate),
        allotmentDate: data.allotmentDate ? new Date(data.allotmentDate) : null,
        listingDate: data.listingDate ? new Date(data.listingDate) : null,
        friendId: data.friendId,
        fundingType: data.fundingType,
        lots: data.lots ?? null,
        mayankContribution: mayankAmt,
        friendContribution: friendAmt,
        profitPct,
        sharedProfitPct: data.sharedProfitPct
          ? new Decimal(data.sharedProfitPct)
          : null,
        sharedProfitBasis: data.sharedProfitBasis ?? null,
        notes: data.notes ?? null,
      },
    });

    // Create disbursement ledger entry for mayank's contribution going to friend
    await tx.ledgerEntry.create({
      data: {
        friendId: data.friendId,
        dealId: newDeal.id,
        type: "DISBURSEMENT",
        amount: mayankAmt,
        direction: "TO_FRIEND",
        note: `Capital disbursed for ${data.ipoName} IPO application`,
      },
    });

    return newDeal;
  });

  return NextResponse.json(
    {
      ...deal,
      mayankContribution: deal.mayankContribution.toString(),
      friendContribution: deal.friendContribution.toString(),
      profitPct: deal.profitPct?.toString() ?? null,
      sharedProfitPct: deal.sharedProfitPct?.toString() ?? null,
      salePrice: deal.salePrice?.toString() ?? null,
    },
    { status: 201 }
  );
}
