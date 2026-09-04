"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewFriendPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    contact: "",
    accountHint: "",
    defaultProfitPct: "0.15",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        contact: form.contact || null,
        accountHint: form.accountHint || null,
        defaultProfitPct: form.defaultProfitPct,
      }),
    });

    if (res.ok) {
      router.push("/friends");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create friend");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/friends" className="p-2 rounded-lg hover:bg-indigo-500/10 text-[#64748b] hover:text-indigo-400 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Add Friend</h1>
          <p className="text-[#64748b] text-xs">New demat account holder</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-group">
            <label className="label" htmlFor="name">Name *</label>
            <input
              id="name"
              className="input-field"
              placeholder="Friend's full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="contact">Contact (optional)</label>
            <input
              id="contact"
              className="input-field"
              placeholder="Phone or email"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="accountHint">
              Bank / UPI Account
              <span className="text-[10px] text-[#64748b] font-normal ml-1">(allotment check ke liye)</span>
            </label>
            <input
              id="accountHint"
              className="input-field"
              placeholder='e.g. "SBI ****1234" or "Zerodha UPI"'
              value={form.accountHint}
              onChange={(e) => setForm({ ...form, accountHint: e.target.value })}
            />
            <p className="text-xs text-[#64748b] mt-1">
              Jis account se IPO apply hoga — BSE/NSE allotment check pe easily identify kar sako.
            </p>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="defaultProfitPct">
              Default Profit % for FULL deals
            </label>
            <div className="relative">
              <input
                id="defaultProfitPct"
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="input-field pr-10"
                placeholder="0.15"
                value={form.defaultProfitPct}
                onChange={(e) =>
                  setForm({ ...form, defaultProfitPct: e.target.value })
                }
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] text-sm">
                {(parseFloat(form.defaultProfitPct || "0") * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              e.g. 0.15 = 15%, 0.20 = 20%. This can be overridden per deal.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/friends" className="btn-secondary flex-1 justify-center">
              Cancel
            </Link>
            <button
              id="create-friend-submit"
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? "Creating…" : "Create Friend"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
