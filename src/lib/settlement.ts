/**
 * Pure settlement calculation functions for IPO deals.
 *
 * Rules sourced from: .agents/skills/profit-settlement/SKILL.md
 *
 * IMPORTANT:
 * - All amounts are in paise (integer-equivalent Decimals).
 * - Never use JS floating-point arithmetic.
 * - Round only at display time, never mid-calculation.
 * - friendPayout + mayankPayout MUST equal salePrice exactly.
 *
 * Worked example from SKILL.md (values in rupees for readability):
 *   friendContribution=4000, mayankContribution=6000, salePrice=12000, sharedProfitPct=0.10
 *   OWN_SHARE   → friend: 4400, mayank: 7600
 *   TOTAL_PROFIT → friend: 4200, mayank: 7800
 */

import { Decimal } from "@prisma/client/runtime/library";

export interface SettlementResult {
  friendPayout: Decimal;
  mayankPayout: Decimal;
  totalProfit: Decimal;
}

// ---------------------------------------------------------------------------
// FULL funding formula
// The friend only lent their demat account; owner funded 100% of capital.
//   totalInvested = mayankContribution  (friendContribution must be 0)
//   totalProfit   = salePrice - totalInvested
//   friendPayout  = totalProfit * profitPct
//   mayankPayout  = salePrice - friendPayout
// ---------------------------------------------------------------------------
export function calcFullSettlement(params: {
  mayankContribution: Decimal;
  salePrice: Decimal;
  profitPct: Decimal; // e.g. Decimal("0.15") for 15%
}): SettlementResult {
  const { mayankContribution, salePrice, profitPct } = params;

  const totalProfit = salePrice.sub(mayankContribution);
  const friendPayout = totalProfit.mul(profitPct);
  const mayankPayout = salePrice.sub(friendPayout);

  return { friendPayout, mayankPayout, totalProfit };
}

// ---------------------------------------------------------------------------
// SHARED / OWN_SHARE formula
// Friend gets their contribution back plus a flat profitPctShared return on it.
// Owner keeps the rest regardless of the deal's real return rate.
//   friendPayout = friendContribution * (1 + profitPctShared)
//   mayankPayout = salePrice - friendPayout
// ---------------------------------------------------------------------------
export function calcSharedOwnShare(params: {
  friendContribution: Decimal;
  salePrice: Decimal;
  sharedProfitPct: Decimal; // e.g. Decimal("0.10") for 10%
}): SettlementResult {
  const { friendContribution, salePrice, sharedProfitPct } = params;

  const mayankContribution = salePrice.sub(friendContribution); // approximation for totalProfit
  const friendPayout = friendContribution.mul(
    new Decimal("1").add(sharedProfitPct)
  );
  const mayankPayout = salePrice.sub(friendPayout);
  const totalProfit = salePrice.sub(friendContribution).sub(mayankContribution);

  return { friendPayout, mayankPayout, totalProfit };
}

// ---------------------------------------------------------------------------
// SHARED / TOTAL_PROFIT formula
// Friend gets their contribution back plus profitPctShared of the whole deal profit.
//   totalInvested = friendContribution + mayankContribution
//   totalProfit   = salePrice - totalInvested
//   friendPayout  = friendContribution + (profitPctShared * totalProfit)
//   mayankPayout  = salePrice - friendPayout
// ---------------------------------------------------------------------------
export function calcSharedTotalProfit(params: {
  friendContribution: Decimal;
  mayankContribution: Decimal;
  salePrice: Decimal;
  sharedProfitPct: Decimal; // e.g. Decimal("0.10") for 10%
}): SettlementResult {
  const { friendContribution, mayankContribution, salePrice, sharedProfitPct } =
    params;

  const totalInvested = friendContribution.add(mayankContribution);
  const totalProfit = salePrice.sub(totalInvested);
  const friendPayout = friendContribution.add(sharedProfitPct.mul(totalProfit));
  const mayankPayout = salePrice.sub(friendPayout);

  return { friendPayout, mayankPayout, totalProfit };
}

// ---------------------------------------------------------------------------
// Dispatcher — given a fully-populated deal, returns the right settlement.
// Throws if sharedProfitBasis is required but missing (never guess).
// ---------------------------------------------------------------------------
export function calcSettlement(deal: {
  fundingType: "FULL" | "SHARED";
  mayankContribution: Decimal;
  friendContribution: Decimal;
  salePrice: Decimal;
  profitPct: Decimal | null;
  sharedProfitPct: Decimal | null;
  sharedProfitBasis: "OWN_SHARE" | "TOTAL_PROFIT" | null;
}): SettlementResult {
  if (deal.fundingType === "FULL") {
    if (!deal.profitPct) {
      throw new Error("profitPct is required for FULL deals");
    }
    return calcFullSettlement({
      mayankContribution: deal.mayankContribution,
      salePrice: deal.salePrice,
      profitPct: deal.profitPct,
    });
  }

  // SHARED deal
  if (!deal.sharedProfitBasis) {
    throw new Error("SHARED_BASIS_REQUIRED");
  }
  if (!deal.sharedProfitPct) {
    throw new Error("sharedProfitPct is required for SHARED deals");
  }

  if (deal.sharedProfitBasis === "OWN_SHARE") {
    return calcSharedOwnShare({
      friendContribution: deal.friendContribution,
      salePrice: deal.salePrice,
      sharedProfitPct: deal.sharedProfitPct,
    });
  }

  // TOTAL_PROFIT
  return calcSharedTotalProfit({
    friendContribution: deal.friendContribution,
    mayankContribution: deal.mayankContribution,
    salePrice: deal.salePrice,
    sharedProfitPct: deal.sharedProfitPct,
  });
}
