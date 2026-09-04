import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      friend: { select: { id: true, name: true, defaultProfitPct: true, accountHint: true } },
      ledgerEntries: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...deal,
    mayankContribution: deal.mayankContribution.toString(),
    friendContribution: deal.friendContribution.toString(),
    profitPct: deal.profitPct?.toString() ?? null,
    sharedProfitPct: deal.sharedProfitPct?.toString() ?? null,
    salePrice: deal.salePrice?.toString() ?? null,
    ledgerEntries: deal.ledgerEntries.map((e) => ({
      ...e,
      amount: e.amount.toString(),
    })),
    friend: {
      ...deal.friend,
      defaultProfitPct: deal.friend.defaultProfitPct.toString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Only allow editing non-financial fields after creation
  // Financial fields (amounts) are immutable once the deal is created
  const allowedFields = ["ipoName", "applyDate", "listingDate", "notes", "sharedProfitBasis"];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    ...deal,
    mayankContribution: deal.mayankContribution.toString(),
    friendContribution: deal.friendContribution.toString(),
    profitPct: deal.profitPct?.toString() ?? null,
    sharedProfitPct: deal.sharedProfitPct?.toString() ?? null,
    salePrice: deal.salePrice?.toString() ?? null,
  });
}
