import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/money";
import { Decimal } from "decimal.js";

import Link from "next/link";

async function getFriends() {
  const friends = await prisma.friend.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deals: true } },
      ledgerEntries: { select: { amount: true, direction: true } },
    },
  });

  return friends.map((f) => {
    const balance = f.ledgerEntries.reduce((acc, e) => {
      const amt = new Decimal(e.amount.toString());
      return e.direction === "TO_FRIEND" ? acc.add(amt) : acc.sub(amt);
    }, new Decimal(0));
    return { ...f, balance };
  });
}

export default async function FriendsPage() {
  const friends = await getFriends();

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Friends</h1>
          <p className="text-[#64748b] text-sm mt-1">
            Manage friends and view their current balances
          </p>
        </div>
        <Link href="/friends/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Friend
        </Link>
      </div>

      {friends.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <p className="text-white font-medium">No friends yet</p>
          <p className="text-[#64748b] text-sm mt-1">
            Add a friend to start tracking IPO deals
          </p>
          <Link href="/friends/new" className="btn-primary inline-flex mt-4">
            Add your first friend
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {friends.map((friend) => {
            const isPositive = friend.balance.gte(0);
            return (
              <div
                key={friend.id}
                className="glass-card glass-card-hover p-6 group relative"
              >
                {/* Edit button — top right, sits above the card link */}
                <Link
                  href={`/friends/${friend.id}/edit`}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-indigo-500/10 text-[#64748b] hover:text-indigo-400 z-10"
                  aria-label={`Edit ${friend.name}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Link>

                {/* Main card — navigates to ledger */}
                <Link href={`/friends/${friend.id}`} className="block">
                  <div className="flex items-center gap-3 mb-4 pr-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-700/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">
                      {friend.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {friend.name}
                      </div>
                      {friend.contact && (
                        <div className="text-xs text-[#64748b]">{friend.contact}</div>
                      )}
                    </div>
                  </div>

                  <div className="divider my-3" />

                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-[#64748b] mb-1">Current Balance</div>
                      <div className={`text-xl font-bold ${isPositive ? "text-amber-400" : "text-emerald-400"}`}>
                        {isPositive ? "" : "−"}{formatINR(friend.balance.abs())}
                      </div>
                      <div className="text-xs text-[#64748b] mt-0.5">
                        {isPositive ? "Holds your capital" : "You owe them"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">
                        {friend._count.deals}
                      </div>
                      <div className="text-xs text-[#64748b]">
                        {friend._count.deals === 1 ? "deal" : "deals"}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

      )}
    </div>
  );
}
