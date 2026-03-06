"use client";

import { useEffect, useState } from "react";

type WaitlistRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  wallet: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ADMIN_PASSCODE = "180476";
const STORAGE_KEY = "siren-admin-pass-ok";

export default function AdminPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setHasAccess(true);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    void loadRows();
  }, [hasAccess]);

  const handlePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === ADMIN_PASSCODE) {
      setHasAccess(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
      setInput("");
    } else {
      setError("Incorrect passcode.");
    }
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist?limit=500`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load waitlist.");
      }
      setRows(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load waitlist.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-void)" }}>
        <div
          className="w-full max-w-sm rounded-2xl border px-6 py-7"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <h1 className="font-heading text-lg mb-3" style={{ color: "var(--text-1)" }}>
            Admin access
          </h1>
          <p className="font-body text-xs mb-5" style={{ color: "var(--text-2)" }}>
            Enter the admin passcode to view waitlist signups.
          </p>
          <form onSubmit={handlePassSubmit} className="space-y-4">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Passcode"
              className="w-full px-4 h-10 rounded-[8px] font-body text-sm border focus:outline-none"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-1)",
              }}
            />
            {error && (
              <p className="font-body text-xs" style={{ color: "var(--down)" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full h-10 rounded-[8px] font-heading text-xs uppercase tracking-[0.12em]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "var(--bg-void)", color: "var(--text-1)" }}>
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-xl">Waitlist admin</h1>
          <button
            type="button"
            onClick={loadRows}
            className="px-3 py-1.5 rounded-[8px] text-xs font-heading uppercase tracking-[0.12em]"
            style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-default)" }}
          >
            Refresh
          </button>
        </header>
        {loading && (
          <p className="font-body text-sm mb-4" style={{ color: "var(--text-2)" }}>
            Loading…
          </p>
        )}
        {error && (
          <p className="font-body text-sm mb-4" style={{ color: "var(--down)" }}>
            {error}
          </p>
        )}
        <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="min-w-full text-left text-xs font-body" style={{ background: "var(--bg-surface)" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <th className="px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  Created
                </th>
                <th className="px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  Name
                </th>
                <th className="px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  Email
                </th>
                <th className="px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  Wallet
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-center text-xs" colSpan={4} style={{ color: "var(--text-3)" }}>
                    No signups yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="px-3 py-2 align-top" style={{ color: "var(--text-2)" }}>
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top">{row.name || "—"}</td>
                    <td className="px-3 py-2 align-top">{row.email}</td>
                    <td className="px-3 py-2 align-top font-mono text-[11px]" style={{ color: "var(--text-2)" }}>
                      {row.wallet || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

