import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

import { calcSettlement } from "@/lib/settlement";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!deal.salePrice) {
    return NextResponse.json(
      { error: "salePrice not set — mark deal as SOLD first" },
      { status: 400 }
    );
  }

  if (deal.fundingType === "SHARED" && !deal.sharedProfitBasis) {
    return NextResponse.json(
      {
        error: "SHARED_BASIS_REQUIRED",
        message: "Set sharedProfitBasis (OWN_SHARE or TOTAL_PROFIT) before previewing settlement.",
      },
      { status: 409 }
    );
  }

  try {
    const result = calcSettlement({
      fundingType: deal.fundingType,
      mayankContribution: deal.mayankContribution,
      friendContribution: deal.friendContribution,
      salePrice: deal.salePrice,
      profitPct: deal.profitPct,
      sharedProfitPct: deal.sharedProfitPct,
      sharedProfitBasis: deal.sharedProfitBasis,
    });

    const totalInvested = deal.mayankContribution.add(deal.friendContribution);

    return NextResponse.json({
      friendPayout: result.friendPayout.toString(),
      mayankPayout: result.mayankPayout.toString(),
      totalProfit: result.totalProfit.toString(),
      totalInvested: totalInvested.toString(),
      salePrice: deal.salePrice.toString(),
      fundingType: deal.fundingType,
      sharedProfitBasis: deal.sharedProfitBasis,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
