/**
 * Unit tests for settlement.ts
 * Verified against the worked example in .agents/skills/profit-settlement/SKILL.md:
 *
 *   friendContribution=4000, mayankContribution=6000, salePrice=12000, sharedProfitPct=0.10
 *   OWN_SHARE    → friend: 4400, mayank: 7600
 *   TOTAL_PROFIT → friend: 4200, mayank: 7800
 */

import { Decimal } from "decimal.js";
import {
  calcFullSettlement,
  calcSharedOwnShare,
  calcSharedTotalProfit,
  calcSettlement,
} from "./settlement";

// Helper: build Decimal from plain number
const D = (n: number | string) => new Decimal(n);

describe("calcFullSettlement", () => {
  it("computes friend and owner payouts correctly at 15%", () => {
    // Deal: mayank puts in 10000, sells for 12000, friend gets 15% of profit
    // totalProfit = 2000, friendPayout = 300, mayankPayout = 11700
    const result = calcFullSettlement({
      mayankContribution: D(10000),
      salePrice: D(12000),
      profitPct: D("0.15"),
    });
    expect(result.friendPayout.toNumber()).toBeCloseTo(300);
    expect(result.mayankPayout.toNumber()).toBeCloseTo(11700);
    expect(result.friendPayout.add(result.mayankPayout).toNumber()).toBe(12000);
  });

  it("computes correctly at 20%", () => {
    const result = calcFullSettlement({
      mayankContribution: D(10000),
      salePrice: D(12000),
      profitPct: D("0.20"),
    });
    expect(result.friendPayout.toNumber()).toBeCloseTo(400);
    expect(result.mayankPayout.toNumber()).toBeCloseTo(11600);
    expect(result.friendPayout.add(result.mayankPayout).toNumber()).toBe(12000);
  });
});

describe("calcSharedOwnShare", () => {
  it("matches SKILL.md worked example: friend=4400, mayank=7600", () => {
    // SKILL.md: friendContribution=4000, salePrice=12000, sharedProfitPct=0.10
    // friendPayout = 4000 * 1.10 = 4400
    // mayankPayout = 12000 - 4400 = 7600
    const result = calcSharedOwnShare({
      friendContribution: D(4000),
      salePrice: D(12000),
      sharedProfitPct: D("0.10"),
    });
    expect(result.friendPayout.toNumber()).toBe(4400);
    expect(result.mayankPayout.toNumber()).toBe(7600);
    expect(result.friendPayout.add(result.mayankPayout).toNumber()).toBe(12000);
  });
});

describe("calcSharedTotalProfit", () => {
  it("matches SKILL.md worked example: friend=4200, mayank=7800", () => {
    // SKILL.md: friendContribution=4000, mayankContribution=6000, salePrice=12000, sharedProfitPct=0.10
    // totalInvested=10000, totalProfit=2000
    // friendPayout = 4000 + 0.10*2000 = 4200
    // mayankPayout = 12000 - 4200 = 7800
    const result = calcSharedTotalProfit({
      friendContribution: D(4000),
      mayankContribution: D(6000),
      salePrice: D(12000),
      sharedProfitPct: D("0.10"),
    });
    expect(result.friendPayout.toNumber()).toBe(4200);
    expect(result.mayankPayout.toNumber()).toBe(7800);
    expect(result.friendPayout.add(result.mayankPayout).toNumber()).toBe(12000);
  });
});

describe("calcSettlement dispatcher", () => {
  it("routes FULL deals correctly", () => {
    const result = calcSettlement({
      fundingType: "FULL",
      mayankContribution: D(10000),
      friendContribution: D(0),
      salePrice: D(12000),
      profitPct: D("0.15"),
      sharedProfitPct: null,
      sharedProfitBasis: null,
    });
    expect(result.friendPayout.toNumber()).toBeCloseTo(300);
  });

  it("throws SHARED_BASIS_REQUIRED when sharedProfitBasis is null on a SHARED deal", () => {
    expect(() =>
      calcSettlement({
        fundingType: "SHARED",
        mayankContribution: D(6000),
        friendContribution: D(4000),
        salePrice: D(12000),
        profitPct: null,
        sharedProfitPct: D("0.10"),
        sharedProfitBasis: null,
      })
    ).toThrow("SHARED_BASIS_REQUIRED");
  });

  it("routes SHARED / OWN_SHARE correctly", () => {
    const result = calcSettlement({
      fundingType: "SHARED",
      mayankContribution: D(6000),
      friendContribution: D(4000),
      salePrice: D(12000),
      profitPct: null,
      sharedProfitPct: D("0.10"),
      sharedProfitBasis: "OWN_SHARE",
    });
    expect(result.friendPayout.toNumber()).toBe(4400);
    expect(result.mayankPayout.toNumber()).toBe(7600);
  });

  it("routes SHARED / TOTAL_PROFIT correctly", () => {
    const result = calcSettlement({
      fundingType: "SHARED",
      mayankContribution: D(6000),
      friendContribution: D(4000),
      salePrice: D(12000),
      profitPct: null,
      sharedProfitPct: D("0.10"),
      sharedProfitBasis: "TOTAL_PROFIT",
    });
    expect(result.friendPayout.toNumber()).toBe(4200);
    expect(result.mayankPayout.toNumber()).toBe(7800);
  });
});
