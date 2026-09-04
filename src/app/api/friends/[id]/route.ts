import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";


const UpdateFriendSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contact: z.string().max(200).nullable().optional(),
  accountHint: z.string().max(100).nullable().optional(),
  defaultProfitPct: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform((v) => new Decimal(v))
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const friend = await prisma.friend.findUnique({
    where: { id },
    include: {
      deals: { orderBy: { applyDate: "desc" } },
      ledgerEntries: { orderBy: { timestamp: "desc" } },
    },
  });

  if (!friend) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Derive balance from ledger
  const balance = friend.ledgerEntries.reduce((acc, e) => {
    const amt = new Decimal(e.amount.toString());
    return e.direction === "TO_FRIEND" ? acc.add(amt) : acc.sub(amt);
  }, new Decimal(0));

  return NextResponse.json({ ...friend, balance: balance.toString() });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateFriendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const friend = await prisma.friend.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(friend);
}
