import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/money";
import { Decimal } from "decimal.js";

import Link from "next/link";
import { notFound } from "next/navigation";
import { DealStatusBadge } from "@/components/DealStatusBadge";

async function getFriendData(id: string) {
  const friend = await prisma.friend.findUnique({
    where: { id },
    include: {
      deals: { orderBy: { applyDate: "desc" } },
      ledgerEntries: {
        orderBy: { timestamp: "asc" },
        include: { deal: { select: { ipoName: true } } },
      },
    },
  });
  if (!friend) notFound();

  let running = new Decimal(0);
  const entriesWithRunning = friend.ledgerEntries.map((e) => {
    const amt = new Decimal(e.amount.toString());
    running = e.direction === "TO_FRIEND" ? running.add(amt) : running.sub(amt);
    return { ...e, amount: amt, runningBalance: running };
  });

  const balance = running;
  return { friend, entriesWithRunning, balance };
}

export default async function FriendLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { friend, entriesWithRunning, balance } = await getFriendData(id);
  const isOwing = balance.gte(0); // positive = friend holds your money

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/friends" className="p-2 rounded-lg hover:bg-indigo-500/10 text-[#64748b] hover:text-indigo-400 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-700/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
              {friend.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{friend.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {friend.accountHint && (
                  <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                    🏦 {friend.accountHint}
                  </span>
                )}
                {friend.contact && (
                  <span className="text-[#64748b] text-xs">{friend.contact}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Link href={`/friends/${id}/edit`} className="btn-secondary btn-sm">
          Edit
        </Link>
      </div>

      {/* Balance Card */}
      <div className="glass-card kpi-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#64748b] mb-1">Current Balance</div>
            <div className={`text-3xl font-bold ${isOwing ? "text-amber-400" : "text-emerald-400"}`}>
              {isOwing ? "" : "−"}{formatINR(balance.abs())}
            </div>
            <div className="text-sm text-[#64748b] mt-1">
              {isOwing
                ? "They hold your capital (you deployed this)"
                : "You owe them a settlement payout"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{friend.deals.length}</div>
            <div className="text-xs text-[#64748b]">deals total</div>
            <div className="text-xs text-[#64748b] mt-1">
              {(friend.defaultProfitPct as unknown as Decimal).mul(100).toFixed(0)}% default profit
            </div>
          </div>
        </div>
      </div>

      {/* Deals */}
      {friend.deals.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-white mb-4">Deals</h2>
          <div className="space-y-2">
            {friend.deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[rgba(15,15,26,0.5)] border border-[rgba(99,102,241,0.08)] hover:border-[rgba(99,102,241,0.25)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <DealStatusBadge status={deal.status} />
                  <div>
                    <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                      {deal.ipoName}
                    </div>
                    <div className="text-xs text-[#64748b]">
                      {new Date(deal.applyDate).toLocaleDateString("en-IN")} ·{" "}
                      {deal.fundingType}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {formatINR(deal.mayankContribution)}
                  </div>
                  <div className="text-xs text-[#64748b]">your capital</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Ledger History
        </h2>
        {entriesWithRunning.length === 0 ? (
          <p className="text-[#64748b] text-sm text-center py-6">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(99,102,241,0.1)]">
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                    Deal
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {entriesWithRunning.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[rgba(99,102,241,0.05)] table-row-hover"
                  >
                    <td className="py-3 px-2 text-[#94a3b8]">
                      {new Date(entry.timestamp).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-2 text-white">{entry.deal.ipoName}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`badge text-[10px] ${
                          entry.type === "DISBURSEMENT"
                            ? "badge-applied"
                            : entry.type === "REFUND"
                            ? "badge-sold"
                            : "badge-settled"
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-medium ${
                        entry.direction === "TO_FRIEND"
                          ? "negative-amount"
                          : "positive-amount"
                      }`}
                    >
                      {entry.direction === "TO_FRIEND" ? "−" : "+"}
                      {formatINR(entry.amount)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-semibold ${
                        entry.runningBalance.gte(0)
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {entry.runningBalance.gte(0) ? "" : "−"}
                      {formatINR(entry.runningBalance.abs())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
