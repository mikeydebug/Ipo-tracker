import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/money";
import { Decimal } from "decimal.js";

import Link from "next/link";
import { DealStatusBadge } from "@/components/DealStatusBadge";

export default async function DealsPage() {
  const deals = await prisma.deal.findMany({
    orderBy: { applyDate: "desc" },
    include: { friend: { select: { name: true } } },
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deals</h1>
          <p className="text-[#64748b] text-sm mt-1">All IPO applications</p>
        </div>
        <Link href="/deals/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <p className="text-white font-medium">No deals yet</p>
          <p className="text-[#64748b] text-sm mt-1">Create your first IPO deal</p>
          <Link href="/deals/new" className="btn-primary inline-flex mt-4">
            Create Deal
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
              <tr className="border-b border-[rgba(99,102,241,0.1)]">
                {["IPO", "Friend", "Type", "Lots", "Applied", "Contribution", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-5 text-xs font-medium text-[#64748b] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="border-b border-[rgba(99,102,241,0.05)] table-row-hover"
                >
                  <td className="py-4 px-5">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="font-medium text-white hover:text-indigo-300 transition-colors"
                    >
                      {deal.ipoName}
                    </Link>
                    {deal.notes && (
                      <div className="text-[11px] text-[#64748b] mt-1 line-clamp-1" title={deal.notes}>
                        {deal.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5 text-[#94a3b8]">
                    {deal.friend.name}
                  </td>
                  <td className="py-4 px-5">
                    <span
                      className={`badge text-[10px] ${
                        deal.fundingType === "FULL"
                          ? "badge-applied"
                          : "badge-allotted"
                      }`}
                    >
                      {deal.fundingType}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-[#94a3b8] text-center">
                    {deal.lots ?? <span className="text-[#475569]">—</span>}
                  </td>
                  <td className="py-4 px-5 text-[#94a3b8]">
                    {new Date(deal.applyDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-4 px-5 font-medium text-white">
                    {formatINR(deal.mayankContribution)}
                    {deal.fundingType === "SHARED" &&
                      deal.friendContribution && (
                        <span className="text-[#64748b] text-xs ml-1">
                          +{formatINR(deal.friendContribution)}
                        </span>
                      )}
                  </td>
                  <td className="py-4 px-5">
                    <Link href={`/deals/${deal.id}`}>
                      <DealStatusBadge status={deal.status} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

