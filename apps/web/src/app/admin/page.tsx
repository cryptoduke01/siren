"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, Trash2, Users, ClipboardList, Copy, Check, KeyRound, Mail, Search } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { PasscodeDigits } from "@/components/PasscodeDigits";
import { AdminNav } from "@/components/AdminNav";

type WaitlistRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  wallet: string | null;
  access_code: string | null;
  access_code_used_at: string | null;
};

type AppUserRow = {
  id: string;
  wallet: string | null;
  auth_user_id: string | null;
  created_at: string;
  last_seen_at: string | null;
  signup_source: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ADMIN_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || "";
const STORAGE_KEY = "siren-admin-pass-ok";

type Tab = "waitlist" | "app-users" | "volume";

type VolumeData = {
  platform7d: number;
  platform30d: number;
  platformAllTime: number;
  byWallet: Array<{ wallet: string; volume7d: number; volume30d: number; volumeAllTime: number }>;
};

function CopyableCell({ value, mono = false }: { value: string | null; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = value || "—";
  const copy = () => {
    if (!value) return;
    hapticLight();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <td className="px-4 py-3 align-top">
      <div className="flex items-start gap-2 group max-w-[320px]">
        <span
          className={`flex-1 min-w-0 break-all ${mono ? "font-mono text-[11px]" : ""}`}
          style={{ color: value ? "var(--text-2)" : "var(--text-3)" }}
        >
          {text}
        </span>
        {value && (
          <button
            type="button"
            onClick={copy}
            className="flex-shrink-0 p-1.5 rounded-md opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: "var(--bg-elevated)" }}
            title="Copy"
            aria-label="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-2)" }} />}
          </button>
        )}
      </div>
    </td>
  );
}

export default function AdminPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("waitlist");
  const [waitlistRows, setWaitlistRows] = useState<WaitlistRow[]>([]);
  const [appUsers, setAppUsers] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendAllLoading, setSendAllLoading] = useState(false);
  const [sendAllResult, setSendAllResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    failedEmails?: string[];
    skippedEmails?: string[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [volumeEmailLoading, setVolumeEmailLoading] = useState(false);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(false);

  const filteredWaitlist = searchQuery.trim()
    ? waitlistRows.filter(
        (r) =>
          r.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.wallet?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : waitlistRows;

  const handlePassSubmit = () => {
    if (!ADMIN_PASSCODE) {
      setError("Admin passcode not configured. Set NEXT_PUBLIC_ADMIN_PASSCODE in env.");
      return;
    }
    if (input.trim() === ADMIN_PASSCODE) {
      setHasAccess(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
      setInput("");
      setError(null);
    } else {
      setError("Incorrect passcode.");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setHasAccess(true);
    }
  }, []);

  useEffect(() => {
    const loadSolPrice = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sol-price`, { credentials: "omit" });
        const j = await res.json();
        setSolPriceUsd(typeof j.usd === "number" ? j.usd : 0);
      } catch {
        setSolPriceUsd(0);
      }
    };
    void loadSolPrice();
  }, []);

  const loadWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist?limit=500`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load waitlist.");
      setWaitlistRows(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load waitlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVolume = useCallback(async () => {
    setVolumeLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/volume`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load volume");
      setVolumeData(data.data ?? { platform7d: 0, byWallet: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load volume");
    } finally {
      setVolumeLoading(false);
    }
  }, []);

  const loadAppUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/users?limit=500`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load app users.");
      setAppUsers(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    void loadWaitlist();
  }, [hasAccess, loadWaitlist]);

  useEffect(() => {
    if (!hasAccess || tab !== "app-users") return;
    void loadAppUsers();
  }, [hasAccess, tab, loadAppUsers]);

  useEffect(() => {
    if (!hasAccess || tab !== "volume") return;
    void loadVolume();
  }, [hasAccess, tab, loadVolume]);

  const refresh = () => {
    if (tab === "waitlist") void loadWaitlist();
    else if (tab === "app-users") void loadAppUsers();
    else if (tab === "volume") void loadVolume();
  };

  const handleDelete = async (id: string) => {
    hapticLight();
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await loadWaitlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleSendAllCodes = async () => {
    hapticLight();
    setSendAllResult(null);
    setSendAllLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/send-all-codes`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSendAllResult({
        sent: data.sent,
        failed: data.failed,
        skipped: data.skipped,
        total: data.total,
        failedEmails: data.failedEmails ?? [],
        skippedEmails: data.skippedEmails ?? [],
      });
      await loadWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send emails");
    } finally {
      setSendAllLoading(false);
    }
  };

  const handleSendVolumeEmail = async () => {
    hapticLight();
    setVolumeEmailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/send-volume-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send volume emails");
      setSendAllResult({
        sent: data.sent,
        failed: data.failed,
        skipped: data.skipped,
        total: data.total,
        failedEmails: data.failedEmails ?? [],
        skippedEmails: data.skippedEmails ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send volume emails");
    } finally {
      setVolumeEmailLoading(false);
    }
  };

  const handleGenerateCode = async (id: string) => {
    hapticLight();
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/${id}/generate-code`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      await loadWaitlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    }
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const handleResendEmail = async (id: string) => {
    hapticLight();
    setResendingId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/${id}/resend-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend email");
      await loadWaitlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setResendingId(null);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-void)" }}>
        <div
          className="w-full max-w-sm rounded-2xl border px-6 py-8"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <h1 className="font-heading font-bold text-xl mb-2" style={{ color: "var(--text-1)" }}>
            Admin access
          </h1>
          <PasscodeDigits
            value={input}
            onChange={setInput}
            onSubmit={handlePassSubmit}
            error={error}
            label="Enter the 6-digit passcode to continue"
            submitLabel="Enter"
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => { hapticLight(); setError(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="w-full max-w-sm rounded-2xl border p-6 text-center"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--down)" }} />
                <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                  Incorrect passcode
                </h3>
                <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setError(null); }}
                  className="w-full py-2.5 rounded-xl font-body text-sm font-medium border"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-1)", borderColor: "var(--border-default)" }}
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-void)", color: "var(--text-1)" }}>
      <AdminNav />
      <div className="flex-1 px-4 py-8 overflow-x-hidden min-w-0">
        <div className="max-w-6xl mx-auto min-w-0">
          <header className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-heading text-xl mb-1">Siren Admin</h1>
              <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                Waitlist signups and app users
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="px-3 py-1.5 rounded-[8px] text-xs font-heading uppercase tracking-[0.12em]"
              style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-default)" }}
            >
              Refresh
            </button>
          </header>

          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <button
              type="button"
              onClick={() => { hapticLight(); setTab("waitlist"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading transition-colors"
              style={{
                background: tab === "waitlist" ? "var(--bg-elevated)" : "transparent",
                color: tab === "waitlist" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "waitlist" ? "1px solid var(--border-default)" : "1px solid transparent",
              }}
            >
              <ClipboardList className="w-4 h-4" />
              Waitlist ({waitlistRows.length})
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setTab("app-users"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading transition-colors"
              style={{
                background: tab === "app-users" ? "var(--bg-elevated)" : "transparent",
                color: tab === "app-users" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "app-users" ? "1px solid var(--border-default)" : "1px solid transparent",
              }}
            >
              <Users className="w-4 h-4" />
              App Users ({appUsers.length})
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setTab("volume"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading transition-colors"
              style={{
                background: tab === "volume" ? "var(--bg-elevated)" : "transparent",
                color: tab === "volume" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "volume" ? "1px solid var(--border-default)" : "1px solid transparent",
              }}
            >
              Volume
            </button>
          </div>

          {loading && (
            <p className="font-body text-sm mb-4" style={{ color: "var(--text-2)" }}>
              Loading…
            </p>
          )}

          {error && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center px-4"
                style={{ background: "rgba(0,0,0,0.6)" }}
                onClick={() => { hapticLight(); setError(null); }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="w-full max-w-sm rounded-2xl border p-6 text-center"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--down)" }} />
                  <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                    Failed to load
                  </h3>
                  <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); setError(null); }}
                    className="w-full py-2.5 rounded-xl font-body text-sm font-medium border"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-1)", borderColor: "var(--border-default)" }}
                  >
                    Close
                  </button>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          )}

          {tab === "waitlist" && (
            <section className="min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-heading text-sm" style={{ color: "var(--text-2)" }}>
                  Waitlist signups — people who joined via the waitlist form
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                    <input
                      type="text"
                      placeholder="Search email, name, wallet..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-2 rounded-lg font-body text-xs w-48 md:w-64 border"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                    />
                  </div>
                <button
                  type="button"
                  onClick={handleSendAllCodes}
                  disabled={sendAllLoading || waitlistRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  {sendAllLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {sendAllLoading ? "Sending…" : "Send access codes to all"}
                </button>
                <button
                  type="button"
                  onClick={handleSendVolumeEmail}
                  disabled={volumeEmailLoading || waitlistRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
                >
                  {volumeEmailLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {volumeEmailLoading ? "Emailing…" : "Email volume sprint"}
                </button>
                </div>
              </div>
              {sendAllResult && (
                <div className="mb-3 space-y-1">
                  <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
                    Sent {sendAllResult.sent}, failed {sendAllResult.failed}, skipped {sendAllResult.skipped} of {sendAllResult.total}.
                  </p>
                  {sendAllResult.failedEmails && sendAllResult.failedEmails.length > 0 && (
                    <details className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                      <summary className="cursor-pointer">View failed emails ({sendAllResult.failedEmails.length})</summary>
                      <div className="mt-1 flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const list = sendAllResult.failedEmails!.join(", ");
                            navigator.clipboard.writeText(list).then(() => {});
                            hapticLight();
                          }}
                          className="self-start px-2 py-1 rounded border text-[10px]"
                          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
                        >
                          Copy all
                        </button>
                        <ul className="list-disc pl-4">
                          {sendAllResult.failedEmails.map((email) => (
                            <li key={email}>{email}</li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  )}
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border min-w-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <table className="w-full min-w-[700px] text-left text-xs font-body">
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Created</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Name</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Email</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Access code</th>
                      <th className="px-4 py-3 border-b w-24 font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWaitlist.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm" colSpan={6} style={{ color: "var(--text-3)" }}>
                          {searchQuery.trim() ? "No matches for your search." : "No waitlist signups yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredWaitlist.map((row) => (
                        <tr key={row.id} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                          <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{new Date(row.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3">{row.name || "—"}</td>
                          <td className="px-4 py-3">{row.email}</td>
                          <CopyableCell value={row.wallet} mono />
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {row.access_code ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[11px]" style={{ color: "var(--text-2)" }}>{row.access_code}</span>
                                  {row.access_code_used_at && (
                                    <>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-3)" }} title={new Date(row.access_code_used_at).toLocaleString()}>Used</span>
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateCode(row.id)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
                                        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                                        title="Regenerate new code"
                                      >
                                        <KeyRound className="w-3.5 h-3.5" />
                                        Regenerate
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => { hapticLight(); navigator.clipboard.writeText(row.access_code!).then(() => {}); }}
                                    className="p-1 rounded"
                                    style={{ color: "var(--text-3)" }}
                                    aria-label="Copy code"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span style={{ color: "var(--text-3)" }}>—</span>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateCode(row.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
                                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                                    title="Generate 6-digit code"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Generate
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {row.access_code && row.email && (
                                <button
                                  type="button"
                                  onClick={() => handleResendEmail(row.id)}
                                  disabled={resendingId === row.id}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-opacity disabled:opacity-50"
                                  style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
                                  title="Resend access code email"
                                >
                                  {resendingId === row.id ? (
                                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                  Resend email
                                </button>
                              )}
                              {!row.access_code && (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateCode(row.id)}
                                  className="p-2 rounded-lg transition-colors"
                                  style={{ color: "var(--accent)" }}
                                  aria-label="Generate access code"
                                  title="Generate 6-digit access code"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: "var(--down)" }}
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "volume" && (
            <section className="min-w-0 overflow-hidden">
              <h2 className="font-heading text-sm mb-3" style={{ color: "var(--text-2)" }}>
                Volume — 7d / 30d / all-time (from API logs; resets on API restart)
              </h2>
              {volumeLoading ? (
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>Loading…</p>
              ) : volumeData ? (
                <div className="space-y-4">
                  {(() => {
                    const p7 = typeof volumeData.platform7d === "number" ? volumeData.platform7d : 0;
                    const p30 = typeof volumeData.platform30d === "number" ? volumeData.platform30d : 0;
                    const pAll = typeof volumeData.platformAllTime === "number" ? volumeData.platformAllTime : 0;
                    const rows = Array.isArray(volumeData.byWallet) ? volumeData.byWallet : [];
                    return (
                  <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                    <p className="font-body text-[11px] mb-1" style={{ color: "var(--text-3)" }}>Platform volume</p>
                    <p className="font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                      7d: {p7.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                    </p>
                    <p className="font-mono text-sm tabular-nums mt-1" style={{ color: "var(--text-2)" }}>
                      30d: {p30.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                    </p>
                    <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
                      All-time: {pAll.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                      {solPriceUsd > 0 && (
                        <span className="text-[11px] ml-1" style={{ color: "var(--text-3)" }}>
                          (≈${(pAll * solPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                    <table className="w-full text-left text-xs font-body">
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)" }}>
                          <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                          <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>7d (SOL)</th>
                          <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>30d (SOL)</th>
                          <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>All-time (SOL)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-center text-sm" colSpan={4} style={{ color: "var(--text-3)" }}>
                              No volume logged yet. Volume is logged when users complete swaps.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => {
                            const v7 = typeof row.volume7d === "number" ? row.volume7d : 0;
                            const v30 = typeof row.volume30d === "number" ? row.volume30d : 0;
                            const vAll = typeof row.volumeAllTime === "number" ? row.volumeAllTime : v7;
                            return (
                            <tr key={row.wallet} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                              <CopyableCell value={row.wallet} mono />
                              <td className="px-4 py-3 font-mono tabular-nums" style={{ color: "var(--text-2)" }}>
                                {v7.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums" style={{ color: "var(--text-2)" }}>
                                {v30.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums" style={{ color: "var(--text-2)" }}>
                                {vAll.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                                {solPriceUsd > 0 && (
                                  <span className="text-[10px] ml-1" style={{ color: "var(--text-3)" }}>
                                    (≈${(vAll * solPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                    );
                  })()}
                </div>
              ) : null}
            </section>
          )}

          {tab === "app-users" && (
            <section>
              <h2 className="font-heading text-sm mb-3" style={{ color: "var(--text-2)" }}>
                App users — users who connected a wallet in the app
              </h2>
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <table className="min-w-full text-left text-xs font-body">
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Created</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Last seen</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Source</th>
                      <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appUsers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm" colSpan={5} style={{ color: "var(--text-3)" }}>
                          No app users yet.
                        </td>
                      </tr>
                    ) : (
                      appUsers.map((row) => (
                        <tr key={row.id} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                          <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{new Date(row.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "—"}</td>
                          <CopyableCell value={row.wallet} mono />
                          <td className="px-4 py-3">{row.signup_source || "—"}</td>
                          <CopyableCell value={row.country} />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

