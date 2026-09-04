import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";


const CreateFriendSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  contact: z.string().max(200).optional().nullable(),
  accountHint: z.string().max(100).optional().nullable(), // e.g. "SBI ****1234" or "Zerodha UPI"
  defaultProfitPct: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a decimal like 0.15")
    .transform((v) => new Decimal(v)),
});

export async function GET() {
  const friends = await prisma.friend.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deals: true } },
      ledgerEntries: {
        select: { amount: true, direction: true },
      },
      deals: {
        where: { status: { in: ["APPLIED", "ALLOTTED"] } },
        select: { id: true },
      },
    },
  });

  const result = friends.map((f) => {
    const balance = f.ledgerEntries.reduce((acc, e) => {
      const amt = new Decimal(e.amount.toString());
      return e.direction === "TO_FRIEND" ? acc.add(amt) : acc.sub(amt);
    }, new Decimal(0));

    const hasActiveDeal = f.deals.length > 0;
    const idleCapital =
      balance.gt(0) && !hasActiveDeal ? balance.toString() : "0";

    return {
      id: f.id,
      name: f.name,
      contact: f.contact,
      accountHint: f.accountHint,
      defaultProfitPct: f.defaultProfitPct.toString(),
      dealCount: f._count.deals,
      balance: balance.toString(),
      idleCapital,
      createdAt: f.createdAt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateFriendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, contact, accountHint, defaultProfitPct } = parsed.data;

  const friend = await prisma.friend.create({
    data: {
      name,
      contact: contact ?? null,
      accountHint: accountHint ?? null,
      defaultProfitPct,
    },
  });

  return NextResponse.json(friend, { status: 201 });
}
