import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const entries = await prisma.ledgerEntry.findMany({
    where: { friendId: id },
    orderBy: { timestamp: "asc" },
    include: {
      deal: { select: { id: true, ipoName: true, status: true } },
    },
  });

  // Build running balance
  let running = new Decimal(0);
  const withRunning = entries.map((e) => {
    const amt = new Decimal(e.amount.toString());
    running = e.direction === "TO_FRIEND" ? running.add(amt) : running.sub(amt);
    return {
      ...e,
      amount: e.amount.toString(),
      runningBalance: running.toString(),
    };
  });

  return NextResponse.json(withRunning);
}
