import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/money";
import { Decimal } from "decimal.js";

import Link from "next/link";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealStatus } from "@prisma/client";
import { calcSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [settledDeals, allFriends, activeDeals, pendingDeals, recentEntries] =
    await Promise.all([
      prisma.deal.findMany({
        where: { status: "SETTLED" },
        select: {
          fundingType: true,
          mayankContribution: true,
          friendContribution: true,
          salePrice: true,
          profitPct: true,
          sharedProfitPct: true,
          sharedProfitBasis: true,
        },
      }),
      prisma.friend.findMany({
        include: {
          ledgerEntries: { select: { amount: true, direction: true } },
          deals: {
            where: { status: { in: ["APPLIED", "ALLOTTED", "SOLD"] } },
            select: { id: true, mayankContribution: true },
          },
        },
      }),
      prisma.deal.findMany({
        where: { status: { in: ["APPLIED", "ALLOTTED", "SOLD"] } },
        select: { id: true, mayankContribution: true, lots: true },
      }),
      prisma.deal.findMany({
        where: { status: { in: ["APPLIED", "ALLOTTED", "SOLD"] } },
        orderBy: { applyDate: "desc" },
        include: { friend: { select: { name: true } } },
        take: 20,
      }),
      prisma.ledgerEntry.findMany({
        orderBy: { timestamp: "desc" },
        take: 15,
        include: {
          friend: { select: { name: true } },
          deal: { select: { ipoName: true } },
        },
      }),
    ]);

  // Net capital actively deployed in open IPOs (Mayank's actual capital locked right now)
  const deployedCapital = activeDeals.reduce(
    (acc, d) => acc.add(new Decimal(d.mayankContribution.toString())),
    new Decimal(0)
  );

  // Total lots applied in active IPOs
  const totalLots = activeDeals.reduce((sum, d) => sum + (d.lots ?? 0), 0);

  // Friend balances: net money sitting with each friend (Total Ledger Balance)
  const friendBalances = allFriends.map((f) => {
    const bal = f.ledgerEntries.reduce((acc, e) => {
      const amt = new Decimal(e.amount.toString());
      return e.direction === "TO_FRIEND" ? acc.add(amt) : acc.sub(amt);
    }, new Decimal(0));
    
    // Calculate deployed capital for this specific friend
    const friendDeployed = f.deals.reduce(
      (acc, d) => acc.add(new Decimal(d.mayankContribution.toString())),
      new Decimal(0)
    );
    
    // Idle capital = Total Balance - Deployed Capital
    // If balance is less than deployed (shouldn't happen unless data is incomplete), cap at 0
    const idleAmount = bal.sub(friendDeployed);
    const actualIdle = idleAmount.gt(0) ? idleAmount : new Decimal(0);

    return { 
      friend: f, 
      ledgerBalance: bal, 
      friendDeployed,
      idleAmount: actualIdle,
      hasActiveDeal: f.deals.length > 0 
    };
  });

  // Idle friends = those who have actual idle capital > 0
  const idleFriends = friendBalances.filter(({ idleAmount }) => idleAmount.gt(0));

  const idleCapital = idleFriends.reduce(
    (acc, { idleAmount }) => acc.add(idleAmount),
    new Decimal(0)
  );

  // Total pool balance = capital in active IPOs + idle capital sitting with friends
  const totalPoolBalance = deployedCapital.add(idleCapital);

  // Real profit earned by Mayank from settled deals (payout minus invested capital)
  let totalProfitEarned = new Decimal(0);
  for (const deal of settledDeals) {
    if (deal.salePrice) {
      try {
        const res = calcSettlement({
          fundingType: deal.fundingType,
          mayankContribution: deal.mayankContribution,
          friendContribution: deal.friendContribution,
          salePrice: deal.salePrice,
          profitPct: deal.profitPct,
          sharedProfitPct: deal.sharedProfitPct,
          sharedProfitBasis: deal.sharedProfitBasis,
        });
        const mayankProfit = res.mayankPayout.sub(deal.mayankContribution);
        totalProfitEarned = totalProfitEarned.add(mayankProfit);
      } catch {
        // Skip any misconfigured deals
      }
    }
  }

  return {
    deployedCapital,
    idleCapital,
    totalPoolBalance,
    totalProfitEarned,
    idleFriends,
    totalLots,
    pendingDeals,
    activeDealsCount: activeDeals.length,
    recentEntries,
    settledCount: settledDeals.length,
  };
}

const PENDING_ACTION_LABEL: Partial<Record<DealStatus, string>> = {
  APPLIED: "Awaiting allotment result",
  ALLOTTED: "Allotted — enter sale price",
  SOLD: "Sold — ready to settle",
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Overview of your IPO investments and settlements
        </p>
      </div>

      {/* KPI Cards — responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Pool Balance"
          value={formatINR(data.totalPoolBalance)}
          subtitle={
            data.idleCapital.gt(0)
              ? `Deployed: ${formatINR(data.deployedCapital)} · Idle: ${formatINR(data.idleCapital)}`
              : `Across ${data.activeDealsCount} active account${data.activeDealsCount !== 1 ? "s" : ""}`
          }
          accent="indigo"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
        <KpiCard
          title="Total Profit Earned"
          value={formatINR(data.totalProfitEarned)}
          subtitle={`${data.settledCount} settled deal${data.settledCount !== 1 ? "s" : ""}`}
          accent="emerald"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />
        <KpiCard
          title="Active IPO Deals"
          value={String(data.pendingDeals.length)}
          subtitle="Applied & awaiting result"
          accent="amber"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
        <KpiCard
          title="Total Lots Applied"
          value={data.totalLots > 0 ? String(data.totalLots) : "—"}
          subtitle="Across active deals"
          accent="indigo"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          }
        />
      </div>

      {/* Pending Deals */}
      {data.pendingDeals.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Needs Action
          </h2>
          <div className="space-y-2">
            {data.pendingDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-[rgba(15,15,26,0.5)] border border-[rgba(99,102,241,0.1)] hover:border-[rgba(99,102,241,0.3)] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <DealStatusBadge status={deal.status} />
                  <div>
                    <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                      {deal.ipoName}
                    </div>
                    <div className="text-xs text-[#64748b]">
                      {deal.friend.name} ·{" "}
                      {PENDING_ACTION_LABEL[deal.status]}
                    </div>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ⚡ Idle Capital — Carry Forward Funds */}
      {data.idleFriends.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <span className="text-lg">⚡</span>
            Idle Capital — Ready for Next IPO
          </h2>
          <p className="text-xs text-[#64748b] mb-4">
            Yeh friends ke accounts mein paisa hai — koi active deal nahi. Next IPO apply karte time no bank transfer needed.
          </p>
          <div className="space-y-2">
            {data.idleFriends.map(({ friend, idleAmount }) => (
              <Link
                key={friend.id}
                href={`/friends/${friend.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-300 font-bold text-xs">
                    {friend.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">
                    {friend.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-400">
                    {formatINR(idleAmount)}
                  </div>
                  <div className="text-[10px] text-[#64748b]">idle in account</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            Recent Activity
          </h2>
          <span className="text-xs text-[#64748b]">
            Money Outflow (−) & Return (+)
          </span>
        </div>
        {data.recentEntries.length === 0 ? (
          <p className="text-[#64748b] text-sm text-center py-6">
            No transactions yet. Create your first deal to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {data.recentEntries.map((entry) => {
              const isOutflow = entry.direction === "TO_FRIEND";
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3 border-b border-[rgba(99,102,241,0.06)] last:border-0 hover:bg-[rgba(99,102,241,0.03)] px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isOutflow
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {isOutflow ? "↓" : "↑"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {entry.deal.ipoName}
                      </div>
                      <div className="text-xs text-[#64748b]">
                        {entry.friend.name} ·{" "}
                        {entry.type === "DISBURSEMENT"
                          ? "Capital Deployed"
                          : entry.type === "REFUND"
                          ? "Refund Received"
                          : "Settlement Return"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        isOutflow ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {isOutflow ? "−" : "+"}
                      {formatINR(entry.amount)}
                    </div>
                    <div className="text-[10px] text-[#64748b]">
                      {new Date(entry.timestamp).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  accent,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  accent: "indigo" | "emerald" | "amber";
  icon: React.ReactNode;
}) {
  const accentClass = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  }[accent];

  return (
    <div className="glass-card kpi-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-sm text-white/70 mt-1 font-medium">{title}</div>
      <div className="text-xs text-[#64748b] mt-0.5">{subtitle}</div>
    </div>
  );
}
