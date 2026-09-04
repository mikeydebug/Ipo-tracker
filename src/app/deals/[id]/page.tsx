"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DealStatusBadge } from "@/components/DealStatusBadge";

interface Deal {
  id: string;
  ipoName: string;
  applyDate: string;
  allotmentDate: string | null;
  listingDate: string | null;
  fundingType: "FULL" | "SHARED";
  lots: number | null;
  mayankContribution: string;
  friendContribution: string;
  profitPct: string | null;
  sharedProfitPct: string | null;
  sharedProfitBasis: "OWN_SHARE" | "TOTAL_PROFIT" | null;
  salePrice: string | null;
  carryForward: boolean;
  status: "APPLIED" | "NOT_ALLOTTED" | "ALLOTTED" | "SOLD" | "SETTLED";
  notes: string | null;
  friend: { id: string; name: string; accountHint: string | null };
  ledgerEntries: Array<{
    id: string;
    type: string;
    amount: string;
    direction: string;
    timestamp: string;
    note: string | null;
  }>;
}

interface SettlementPreview {
  friendPayout: string;
  mayankPayout: string;
  totalProfit: string;
  totalInvested: string;
  salePrice: string;
  fundingType: string;
  sharedProfitBasis: string | null;
}

function formatINRClient(paise: string | number): string {
  const num = typeof paise === "string" ? parseFloat(paise) : paise;
  const rupees = num / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Transition-specific state
  const [salePriceInput, setSalePriceInput] = useState("");
  const [basisChoice, setBasisChoice] = useState<
    "" | "OWN_SHARE" | "TOTAL_PROFIT"
  >("");
  const [showBasisPrompt, setShowBasisPrompt] = useState(false);
  const [settlementPreview, setSettlementPreview] =
    useState<SettlementPreview | null>(null);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);

  const [id, setId] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
      loadDeal(id);
    });
  }, [params]);

  const loadDeal = async (dealId: string) => {
    setLoading(true);
    const res = await fetch(`/api/deals/${dealId}`);
    if (res.ok) {
      const data = await res.json();
      setDeal(data);
    }
    setLoading(false);
  };

  const doTransition = async (
    targetStatus: string,
    extra?: Record<string, string | boolean>
  ) => {
    setActionLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/deals/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, ...extra }),
    });

    const data = await res.json();

    if (res.status === 409 && data.error === "SHARED_BASIS_REQUIRED") {
      setShowBasisPrompt(true);
      setActionLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Transition failed");
      setActionLoading(false);
      return;
    }

    setSuccess(`Status updated to ${data.status}`);
    await loadDeal(id);
    setActionLoading(false);
    setShowSettlementConfirm(false);
    setSettlementPreview(null);
  };

  const handleMarkNotAllotted = () =>
    doTransition("NOT_ALLOTTED");

  const handleMarkAllotted = () => doTransition("ALLOTTED");

  const handleMarkSold = async () => {
    if (!salePriceInput || parseFloat(salePriceInput) <= 0) {
      setError("Enter a valid sale price");
      return;
    }
    const salePricePaise = String(
      Math.round(parseFloat(salePriceInput) * 100)
    );
    await doTransition("SOLD", {
      salePrice: salePricePaise,
      ...(basisChoice ? { sharedProfitBasis: basisChoice } : {}),
    });
  };

  const handlePreviewSettlement = async () => {
    // If SHARED and no basis set, show the basis prompt first
    if (
      deal?.fundingType === "SHARED" &&
      !deal.sharedProfitBasis &&
      !basisChoice
    ) {
      setShowBasisPrompt(true);
      return;
    }

    // Fetch preview
    const basisParam =
      basisChoice ||
      (deal?.sharedProfitBasis ? `&sharedProfitBasis=${deal.sharedProfitBasis}` : "");
    let url = `/api/deals/${id}/settlement-preview`;
    const res = await fetch(url);
    const data = await res.json();

    if (res.status === 409 && data.error === "SHARED_BASIS_REQUIRED") {
      setShowBasisPrompt(true);
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Preview failed");
      return;
    }

    setSettlementPreview(data);
    setShowSettlementConfirm(true);
  };

  const handleConfirmSettle = () => {
    doTransition("SETTLED", basisChoice ? { sharedProfitBasis: basisChoice } : {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-[#64748b]">Loading deal…</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="glass-card p-8 text-center text-[#64748b]">
        Deal not found.{" "}
        <Link href="/deals" className="text-indigo-400 underline">
          Back to deals
        </Link>
      </div>
    );
  }

  const totalInvested =
    parseFloat(deal.mayankContribution) + parseFloat(deal.friendContribution);
  const isTerminal = ["NOT_ALLOTTED", "SETTLED"].includes(deal.status);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/deals" className="p-2 rounded-lg hover:bg-indigo-500/10 text-[#64748b] hover:text-indigo-400 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{deal.ipoName}</h1>
            <DealStatusBadge status={deal.status} />
          </div>
          <p className="text-[#64748b] text-xs mt-0.5">
            {deal.friend.name} ·{" "}
            {new Date(deal.applyDate).toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* SHARED_BASIS_REQUIRED prompt */}
      {showBasisPrompt && (
        <div className="glass-card p-6 border-amber-500/30 border">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
              ⚠
            </div>
            <div>
              <div className="font-semibold text-white">Profit Basis Required</div>
              <p className="text-sm text-[#94a3b8] mt-1">
                This SHARED deal has no <code className="text-amber-300">sharedProfitBasis</code> set. You must choose which formula applies before settlement can proceed. The two options produce different payouts — only you can decide.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setBasisChoice("OWN_SHARE")}
              className={`p-4 rounded-xl border text-left transition-all ${
                basisChoice === "OWN_SHARE"
                  ? "border-indigo-500/60 bg-indigo-500/10"
                  : "border-[rgba(99,102,241,0.15)] hover:border-[rgba(99,102,241,0.3)]"
              }`}
            >
              <div className="font-semibold text-white text-sm mb-1">OWN_SHARE</div>
              <div className="text-xs text-[#64748b]">
                Friend gets their capital back + flat % return on it. Owner keeps the rest.
              </div>
              <div className="text-xs text-indigo-300 mt-2">
                Friend: {formatINRClient(deal.friendContribution)} × (1 +{" "}
                {deal.sharedProfitPct
                  ? (parseFloat(deal.sharedProfitPct) * 100).toFixed(0)
                  : "?"}
                %)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBasisChoice("TOTAL_PROFIT")}
              className={`p-4 rounded-xl border text-left transition-all ${
                basisChoice === "TOTAL_PROFIT"
                  ? "border-indigo-500/60 bg-indigo-500/10"
                  : "border-[rgba(99,102,241,0.15)] hover:border-[rgba(99,102,241,0.3)]"
              }`}
            >
              <div className="font-semibold text-white text-sm mb-1">TOTAL_PROFIT</div>
              <div className="text-xs text-[#64748b]">
                Friend gets their capital back + % of the whole deal&apos;s profit.
              </div>
              <div className="text-xs text-indigo-300 mt-2">
                Friend: {formatINRClient(deal.friendContribution)} + (
                {deal.sharedProfitPct
                  ? (parseFloat(deal.sharedProfitPct) * 100).toFixed(0)
                  : "?"}
                % × total profit)
              </div>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowBasisPrompt(false);
                setBasisChoice("");
              }}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!basisChoice}
              onClick={async () => {
                // Save the basis to the deal first
                await fetch(`/api/deals/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sharedProfitBasis: basisChoice }),
                });
                setShowBasisPrompt(false);
                await loadDeal(id);
              }}
              className="btn-primary btn-sm"
            >
              Set Basis & Continue
            </button>
          </div>
        </div>
      )}

      {/* Main Deal Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Deal details card */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">
            Deal Details
          </h2>

          <Row label="IPO" value={deal.ipoName} />
          <Row label="Friend" value={
            <div className="flex items-center gap-2">
              <Link href={`/friends/${deal.friend.id}`} className="text-indigo-400 hover:underline">
                {deal.friend.name}
              </Link>
              {deal.friend.accountHint && (
                <span className="text-[10px] text-[#94a3b8] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-md border border-[rgba(255,255,255,0.1)]">
                  🏦 {deal.friend.accountHint}
                </span>
              )}
            </div>
          } />
          <Row label="Funding Type" value={
            <span className={`badge text-[10px] ${deal.fundingType === "FULL" ? "badge-applied" : "badge-allotted"}`}>
              {deal.fundingType}
            </span>
          } />
          <Row label="Apply Date" value={new Date(deal.applyDate).toLocaleDateString("en-IN")} />
          {deal.allotmentDate && (
            <Row label="Allotment Date" value={
              <div className="flex items-center gap-2">
                {new Date(deal.allotmentDate).toLocaleDateString("en-IN")}
                <span className="text-[10px] text-amber-400 border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 rounded">Refund next day</span>
              </div>
            } />
          )}
          {deal.listingDate && (
            <Row label="Listing Date" value={new Date(deal.listingDate).toLocaleDateString("en-IN")} />
          )}
          {deal.notes && <Row label="Notes" value={deal.notes} />}
        </div>

        {/* Financials card */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">
            Financials
          </h2>

          <Row label="Your Capital" value={
            <span className="text-white font-semibold">{formatINRClient(deal.mayankContribution)}</span>
          } />
          {deal.fundingType === "SHARED" && (
            <Row label="Friend's Capital" value={
              <span className="text-emerald-400 font-semibold">{formatINRClient(deal.friendContribution)}</span>
            } />
          )}
          <Row label="Total Applied" value={
            <span className="text-white font-bold">{formatINRClient(totalInvested)}</span>
          } />

          {deal.lots && (
            <Row label="Lots Applied" value={
              <span className="text-indigo-300 font-semibold">{deal.lots} lot{deal.lots > 1 ? "s" : ""}</span>
            } />
          )}

          {deal.carryForward && deal.status === "NOT_ALLOTTED" && (
            <Row label="Capital Status" value={
              <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                ⚡ Carry Forward — in account
              </span>
            } />
          )}

          {deal.fundingType === "FULL" && deal.profitPct && (
            <Row label="Friend's Profit %" value={`${(parseFloat(deal.profitPct) * 100).toFixed(0)}%`} />
          )}
          {deal.fundingType === "SHARED" && (
            <>
              {deal.sharedProfitPct && (
                <Row label="Friend's Share %" value={`${(parseFloat(deal.sharedProfitPct) * 100).toFixed(0)}%`} />
              )}
              <Row
                label="Profit Basis"
                value={
                  deal.sharedProfitBasis ? (
                    <span className="badge badge-allotted text-[10px]">
                      {deal.sharedProfitBasis}
                    </span>
                  ) : (
                    <span className="text-amber-400 text-xs">⚠ Not set — required for settlement</span>
                  )
                }
              />
            </>
          )}

          {deal.salePrice && (
            <Row label="Sale Price" value={
              <span className="text-emerald-400 font-bold">{formatINRClient(deal.salePrice)}</span>
            } />
          )}
        </div>
      </div>

      {/* Action Panel */}
      {!isTerminal && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-4">
            Next Action
          </h2>

          {/* APPLIED */}
          {deal.status === "APPLIED" && (
            <div className="space-y-4">
              <p className="text-sm text-[#94a3b8]">
                What was the allotment result for this IPO?
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  id="mark-allotted-btn"
                  onClick={handleMarkAllotted}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  ✓ Allotted — Got shares
                </button>
                <button
                  id="mark-not-allotted-refund-btn"
                  onClick={handleMarkNotAllotted}
                  disabled={actionLoading}
                  className="btn-danger"
                >
                  ✗ Not Allotted — Refund received
                </button>
                <button
                  id="mark-not-allotted-carry-btn"
                  onClick={() => doTransition("NOT_ALLOTTED", { carryForward: true })}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
                >
                  ⚡ Not Allotted — Keep in account (next IPO)
                </button>
              </div>
              <p className="text-xs text-[#64748b]">
                &ldquo;Keep in account&rdquo; = paisa {deal.friend.name} ke account mein wahin rehne do, next IPO ke liye use karo. Koi refund entry nahi hogi.
              </p>
            </div>
          )}

          {/* ALLOTTED → SOLD */}
          {deal.status === "ALLOTTED" && (
            <div className="space-y-3">
              <p className="text-sm text-[#94a3b8]">
                Shares were allotted. Enter the total sale proceeds to mark as sold.
              </p>
              <div className="flex gap-3 items-end">
                <div className="form-group flex-1">
                  <label className="label" htmlFor="salePriceInput">
                    Total Sale Price (₹)
                  </label>
                  <input
                    id="salePriceInput"
                    type="number"
                    step="0.01"
                    min="1"
                    className="input-field"
                    placeholder="e.g. 18000"
                    value={salePriceInput}
                    onChange={(e) => setSalePriceInput(e.target.value)}
                  />
                </div>
                <button
                  id="mark-sold-btn"
                  onClick={handleMarkSold}
                  disabled={actionLoading || !salePriceInput}
                  className="btn-primary"
                >
                  Mark Sold
                </button>
              </div>
              {salePriceInput && totalInvested > 0 && (
                <div className="text-xs text-[#64748b]">
                  Implied profit:{" "}
                  <span className="text-emerald-400 font-medium">
                    {formatINRClient(
                      String(
                        Math.round(parseFloat(salePriceInput) * 100) -
                          totalInvested
                      )
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SOLD → SETTLED */}
          {deal.status === "SOLD" && !showSettlementConfirm && (
            <div className="space-y-3">
              <p className="text-sm text-[#94a3b8]">
                Shares sold at{" "}
                <span className="text-white font-medium">
                  {formatINRClient(deal.salePrice!)}
                </span>
                . Preview the settlement before confirming.
              </p>

              {deal.fundingType === "SHARED" && !deal.sharedProfitBasis && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm">
                  ⚠ Set sharedProfitBasis before settlement can proceed.
                </div>
              )}

              <button
                id="preview-settlement-btn"
                onClick={handlePreviewSettlement}
                disabled={actionLoading}
                className="btn-primary"
              >
                Preview Settlement
              </button>
            </div>
          )}

          {/* Settlement confirmation */}
          {deal.status === "SOLD" && showSettlementConfirm && settlementPreview && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/25">
                <div className="text-sm font-semibold text-white mb-3">
                  Settlement Breakdown
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#64748b] mb-1">Friend receives</div>
                    <div className="text-xl font-bold text-emerald-400">
                      {formatINRClient(settlementPreview.friendPayout)}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">
                      {deal.fundingType === "FULL"
                        ? `${((parseFloat(settlementPreview.friendPayout) / (parseFloat(settlementPreview.salePrice) - parseFloat(settlementPreview.totalInvested))) * 100).toFixed(1)}% of profit`
                        : `via ${settlementPreview.sharedProfitBasis}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748b] mb-1">You receive</div>
                    <div className="text-xl font-bold text-indigo-300">
                      {formatINRClient(settlementPreview.mayankPayout)}
                    </div>
                    <div className="text-xs text-emerald-400 mt-0.5">
                      Profit: {formatINRClient(
                        String(parseFloat(settlementPreview.mayankPayout) - parseFloat(deal.mayankContribution))
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[#64748b] mt-3 pt-3 border-t border-[rgba(99,102,241,0.1)]">
                  Total profit on deal:{" "}
                  <span className="text-white font-medium">
                    {formatINRClient(settlementPreview.totalProfit)}
                  </span>{" "}
                  · Reconciles to sale price{" "}
                  <span className="text-emerald-400">✓</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettlementConfirm(false);
                    setSettlementPreview(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  id="confirm-settle-btn"
                  onClick={handleConfirmSettle}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  {actionLoading ? "Settling…" : "Confirm & Settle"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ledger Entries */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-4">
          Ledger Entries
        </h2>
        {deal.ledgerEntries.length === 0 ? (
          <p className="text-[#64748b] text-sm">No entries yet.</p>
        ) : (
          <div className="space-y-2">
            {deal.ledgerEntries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between py-3 border-b border-[rgba(99,102,241,0.06)] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      e.type === "DISBURSEMENT"
                        ? "bg-indigo-500/10 text-indigo-400"
                        : e.type === "REFUND"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {e.type[0]}
                  </div>
                  <div>
                    <div className="text-sm text-white capitalize">
                      {e.type.toLowerCase()}{" "}
                      <span className="text-[#64748b] text-xs">
                        ({e.direction === "TO_FRIEND" ? "→ friend" : "← you"})
                      </span>
                    </div>
                    {e.note && (
                      <div className="text-xs text-[#64748b]">{e.note}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-semibold text-sm ${
                      e.direction === "TO_FRIEND"
                        ? "negative-amount"
                        : "positive-amount"
                    }`}
                  >
                    {e.direction === "TO_FRIEND" ? "−" : "+"}
                    {formatINRClient(e.amount)}
                  </div>
                  <div className="text-xs text-[#64748b]">
                    {new Date(e.timestamp).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[#64748b] flex-shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}
