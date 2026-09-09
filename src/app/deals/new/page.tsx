"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Friend {
  id: string;
  name: string;
  contact: string | null;
  accountHint: string | null;
  defaultProfitPct: string;
  idleCapital: string;
}

interface FriendRow {
  friendId: string;
  enabled: boolean;
  mayankContribution: string;
  friendContribution: string;
  profitPct: string;
  sharedProfitPct: string;
}

function NewDealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean; dealId?: string }[]>([]);

  // IPO-level fields (entered once)
  const [ipo, setIpo] = useState({
    ipoName: searchParams.get("ipoName") || "",
    applyDate: searchParams.get("applyDate") || new Date().toISOString().slice(0, 10),
    allotmentDate: searchParams.get("allotmentDate") || "",
    listingDate: searchParams.get("listingDate") || "",
    fundingType: (searchParams.get("fundingType") as "FULL" | "SHARED") || "FULL",
    lots: searchParams.get("lots") || "",
    notes: "",
  });

  // Per-friend rows
  const [rows, setRows] = useState<FriendRow[]>([]);

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => r.json())
      .then((data: Friend[]) => {
        setFriends(data);
        setRows(
          data.map((f) => ({
            friendId: f.id,
            enabled: false,
            mayankContribution: "",
            friendContribution: "",
            profitPct: (parseFloat(f.defaultProfitPct) * 100).toFixed(0),
            sharedProfitPct: (parseFloat(f.defaultProfitPct) * 100).toFixed(0),
          }))
        );
      });
  }, []);

  const updateRow = (friendId: string, patch: Partial<FriendRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.friendId === friendId ? { ...r, ...patch } : r))
    );
  };

  const enabledRows = rows.filter((r) => r.enabled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledRows.length === 0) {
      setError("Kam se kam ek friend select karo.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResults([]);

    const outcomes: { name: string; ok: boolean; dealId?: string }[] = [];

    for (const row of enabledRows) {
      const friend = friends.find((f) => f.id === row.friendId)!;
      const body = {
        ipoName: ipo.ipoName,
        applyDate: new Date(ipo.applyDate).toISOString(),
        allotmentDate: ipo.allotmentDate
          ? new Date(ipo.allotmentDate).toISOString()
          : null,
        listingDate: ipo.listingDate
          ? new Date(ipo.listingDate).toISOString()
          : null,
        friendId: row.friendId,
        fundingType: ipo.fundingType,
        lots: ipo.lots ? parseInt(ipo.lots) : null,
        mayankContribution: String(
          Math.round((parseFloat(row.mayankContribution) || 0) * 100)
        ),
        friendContribution:
          ipo.fundingType === "SHARED"
            ? String(Math.round((parseFloat(row.friendContribution) || 0) * 100))
            : "0",
        profitPct:
          ipo.fundingType === "FULL" && row.profitPct
            ? String(parseFloat(row.profitPct) / 100)
            : null,
        sharedProfitPct:
          ipo.fundingType === "SHARED" && row.sharedProfitPct
            ? String(parseFloat(row.sharedProfitPct) / 100)
            : null,
        notes: ipo.notes || null,
      };

      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const deal = await res.json();
        outcomes.push({ name: friend.name, ok: true, dealId: deal.id });
      } else {
        const data = await res.json();
        outcomes.push({ name: friend.name, ok: false });
        setError(`${friend.name}: ${data.error ?? "Failed"}`);
      }
    }

    setResults(outcomes);
    setSubmitting(false);

    // If all succeeded and only one deal, navigate to it
    const successes = outcomes.filter((o) => o.ok);
    if (successes.length === outcomes.length) {
      if (successes.length === 1) {
        router.push(`/deals/${successes[0].dealId}`);
      } else {
        router.push("/deals");
      }
    }
  };

  return (
    <div className="max-w-3xl animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/deals"
          className="p-2 rounded-lg hover:bg-indigo-500/10 text-[#64748b] hover:text-indigo-400 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">New IPO Deal</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            IPO details ek baar bharo — phir select karo kiske account se apply karna hai
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── IPO Details Card ─────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">
            IPO Details (ek baar)
          </h2>

          {/* IPO Name */}
          <div className="form-group">
            <label className="label" htmlFor="ipoName">IPO Name *</label>
            <input
              id="ipoName"
              type="text"
              className="input-field"
              placeholder="e.g. Bajaj Housing Finance"
              value={ipo.ipoName}
              onChange={(e) => setIpo({ ...ipo, ipoName: e.target.value })}
              required
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="label" htmlFor="applyDate">Apply Date *</label>
              <input
                id="applyDate"
                type="date"
                className="input-field"
                value={ipo.applyDate}
                onChange={(e) => setIpo({ ...ipo, applyDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="allotmentDate">
                Allotment Date
                <span className="text-[10px] text-amber-400 ml-1 font-normal">(refund = agle din)</span>
              </label>
              <input
                id="allotmentDate"
                type="date"
                className="input-field"
                value={ipo.allotmentDate}
                onChange={(e) => setIpo({ ...ipo, allotmentDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="listingDate">Listing Date</label>
              <input
                id="listingDate"
                type="date"
                className="input-field"
                value={ipo.listingDate}
                onChange={(e) => setIpo({ ...ipo, listingDate: e.target.value })}
              />
            </div>
          </div>

          {/* Funding Type + Lots */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Funding Type *</label>
              <div className="flex gap-2">
                {(["FULL", "SHARED"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setIpo({ ...ipo, fundingType: type })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      ipo.fundingType === type
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                        : "bg-transparent border-[rgba(99,102,241,0.15)] text-[#64748b] hover:border-[rgba(99,102,241,0.3)]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="lots">Lots per account</label>
              <input
                id="lots"
                type="number"
                min="1"
                step="1"
                className="input-field"
                placeholder="e.g. 1"
                value={ipo.lots}
                onChange={(e) => setIpo({ ...ipo, lots: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="label" htmlFor="notes">Notes (optional)</label>
            <input
              id="notes"
              type="text"
              className="input-field"
              placeholder="Any extra info..."
              value={ipo.notes}
              onChange={(e) => setIpo({ ...ipo, notes: e.target.value })}
            />
          </div>
        </div>

        {/* ── Friends Table ──────────────────────────────────── */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">
            Select Friends &amp; Amounts
          </h2>
          <p className="text-xs text-[#64748b]">
            Checkmark karo jis friend ke account se apply karna hai. Har row = alag deal.
          </p>

          {friends.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm">
              <Link href="/friends/new" className="underline">Pehle koi friend add karo</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => {
                const row = rows.find((r) => r.friendId === friend.id);
                if (!row) return null;
                const idle = parseFloat(friend.idleCapital);
                return (
                  <div
                    key={friend.id}
                    className={`rounded-xl border p-4 transition-all ${
                      row.enabled
                        ? "border-indigo-500/40 bg-indigo-500/5"
                        : "border-[rgba(99,102,241,0.1)] bg-transparent opacity-60"
                    }`}
                  >
                    {/* Friend header row */}
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => updateRow(friend.id, { enabled: !row.enabled })}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                          row.enabled
                            ? "bg-indigo-500 border-indigo-500"
                            : "border-[rgba(99,102,241,0.4)] bg-transparent"
                        }`}
                        aria-label={`Toggle ${friend.name}`}
                      >
                        {row.enabled && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-indigo-700/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-xs">
                        {friend.name[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{friend.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {friend.accountHint && (
                            <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                              🏦 {friend.accountHint}
                            </span>
                          )}
                          {friend.contact && (
                            <span className="text-[10px] text-[#64748b]">{friend.contact}</span>
                          )}
                        </div>
                      </div>

                      {idle > 0 && (
                        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-2 py-1 rounded-lg flex-shrink-0">
                          ⚡ ₹{(idle / 100).toLocaleString("en-IN")} idle
                        </span>
                      )}
                    </div>

                    {/* Per-friend amount fields (only when enabled) */}
                    {row.enabled && (
                      <div className="grid grid-cols-2 gap-3 mt-2 pl-8">
                        <div>
                          <label className="label text-[11px]">Your Contribution (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            className="input-field text-sm"
                            placeholder="e.g. 14000"
                            value={row.mayankContribution}
                            onChange={(e) =>
                              updateRow(friend.id, { mayankContribution: e.target.value })
                            }
                            required={row.enabled}
                          />
                        </div>

                        {ipo.fundingType === "FULL" ? (
                          <div>
                            <label className="label text-[11px]">Friend&apos;s Profit % *</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                className="input-field text-sm"
                                placeholder="e.g. 15"
                                value={row.profitPct}
                                onChange={(e) =>
                                  updateRow(friend.id, { profitPct: e.target.value })
                                }
                              />
                              <span className="text-[#64748b] text-sm">%</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="label text-[11px]">Friend&apos;s Contribution (₹) *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input-field text-sm"
                                placeholder="e.g. 14000"
                                value={row.friendContribution}
                                onChange={(e) =>
                                  updateRow(friend.id, { friendContribution: e.target.value })
                                }
                                required={row.enabled && ipo.fundingType === "SHARED"}
                              />
                            </div>
                            <div>
                              <label className="label text-[11px]">Friend&apos;s Profit Share %</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="input-field text-sm"
                                  placeholder="e.g. 15"
                                  value={row.sharedProfitPct}
                                  onChange={(e) =>
                                    updateRow(friend.id, { sharedProfitPct: e.target.value })
                                  }
                                />
                                <span className="text-[#64748b] text-sm">%</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results preview */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.name}
                className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
                  r.ok
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-red-500/10 border-red-500/25 text-red-400"
                }`}
              >
                {r.ok ? "✓" : "✗"} {r.name}
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || enabledRows.length === 0}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Creating..."
              : enabledRows.length === 0
              ? "Koi friend select nahi"
              : `Create ${enabledRows.length} Deal${enabledRows.length > 1 ? "s" : ""} →`}
          </button>
          <Link href="/deals" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewDealPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12 text-[#64748b]">Loading form...</div>}>
      <NewDealForm />
    </Suspense>
  );
}
