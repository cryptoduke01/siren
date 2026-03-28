"use client";

import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XCircle,
  Trash2,
  Users,
  ClipboardList,
  Copy,
  Check,
  KeyRound,
  Mail,
  Search,
  Activity,
  ChartColumnBig,
  Gauge,
  Rocket,
  Sparkles,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { hapticLight } from "@/lib/haptics";
import { PasscodeDigits } from "@/components/PasscodeDigits";
import { AdminNav } from "@/components/AdminNav";
import { fetchSolPriceUsd } from "@/lib/pricing";

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
const LAUNCH_THREAD_URL = "https://x.com/cryptoduke01/status/2037410069109768374";
const LAUNCH_THREAD_IMAGE = "/emails/launch-thread-cover.jpg";
const LAUNCH_THREAD_TITLE = "Prediction Markets, Memes, and The Madness";
const LAUNCH_THREAD_PREVIEW =
  "There is a particular kind of suffering that belongs only to the man who sees what is coming and cannot make anyone believe him.";
const TABLE_PAGE_SIZE = 25;
const PANEL_BG =
  "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 94%, white 6%) 0%, color-mix(in srgb, var(--bg-elevated) 96%, transparent) 100%)";
const HERO_BG =
  "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 24%), radial-gradient(circle at top right, color-mix(in srgb, var(--kalshi) 18%, transparent), transparent 26%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 96%, transparent) 0%, color-mix(in srgb, var(--bg-base) 96%, transparent) 100%)";
const PANEL_BORDER = "color-mix(in srgb, var(--border-default) 76%, var(--accent) 24%)";
const SUBTLE_BORDER = "color-mix(in srgb, var(--border-subtle) 84%, var(--accent) 16%)";
const SOFT_BG = "color-mix(in srgb, var(--bg-elevated) 88%, transparent)";
const BADGE_BG = "color-mix(in srgb, var(--accent-dim) 70%, var(--bg-elevated) 30%)";
const TOOLTIP_BG = "color-mix(in srgb, var(--bg-base) 94%, var(--bg-surface) 6%)";
const GRID_STROKE = "color-mix(in srgb, var(--border-subtle) 52%, transparent)";
const TAB_ACTIVE_BG = "color-mix(in srgb, var(--bg-elevated) 82%, white 18%)";
const IMAGE_OVERLAY_BG =
  "linear-gradient(90deg, color-mix(in srgb, var(--bg-base) 8%, transparent) 0%, color-mix(in srgb, var(--bg-base) 74%, transparent) 100%)";

type Tab = "waitlist" | "app-users" | "volume";

type VolumeData = {
  platform7d: number;
  platform30d: number;
  platformAllTime: number;
  byWallet: Array<{ wallet: string; volume7d: number; volume30d: number; volumeAllTime: number }>;
};

type DispatchResult = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  failedEmails?: string[];
  skippedEmails?: string[];
};

function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function formatCompactNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value);
}

function formatSol(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function renderDispatchList(list: string[] | undefined, label: string) {
  if (!list || list.length === 0) return null;
  return (
    <details className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
      <summary className="cursor-pointer">{label} ({list.length})</summary>
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(list.join(", ")).then(() => {});
            hapticLight();
          }}
          className="self-start px-2 py-1 rounded border text-[10px]"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
        >
          Copy all
        </button>
        <ul className="list-disc pl-4">
          {list.map((email) => (
            <li key={`${label}-${email}`}>{email || "Unknown email"}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function DispatchSummary({ result, accentLabel }: { result: DispatchResult | null; accentLabel: string }) {
  if (!result) return null;

  return (
    <div
      className="rounded-2xl border p-4 space-y-2"
      style={{
        background: PANEL_BG,
        borderColor: PANEL_BORDER,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-heading uppercase tracking-[0.18em]"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          {accentLabel}
        </span>
        <span className="font-body text-xs" style={{ color: "var(--text-2)" }}>
          Sent {result.sent}, failed {result.failed}, skipped {result.skipped} of {result.total}.
        </span>
      </div>
      {renderDispatchList(result.failedEmails, "Failed emails")}
      {renderDispatchList(result.skippedEmails, "Skipped emails")}
    </div>
  );
}

function InlineDispatchStatus({ result, label }: { result: DispatchResult | null; label: string }) {
  if (!result) return null;

  return (
    <div
      aria-live="polite"
      className="mt-4 rounded-2xl border px-4 py-3"
      style={{ borderColor: PANEL_BORDER, background: BADGE_BG }}
    >
      <p className="font-heading text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
        {label}
      </p>
      <p className="mt-1 font-body text-sm" style={{ color: "var(--text-1)" }}>
        Sent {result.sent}, failed {result.failed}, skipped {result.skipped} of {result.total}.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] border p-4"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 14%, transparent), transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 94%, white 6%) 0%, color-mix(in srgb, var(--bg-elevated) 96%, transparent) 100%)",
        borderColor: PANEL_BORDER,
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--text-1) 6%, transparent)",
      }}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="font-body text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
          {label}
        </p>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl border"
          style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG, color: "var(--accent)" }}
        >
          {icon}
        </div>
      </div>
      <p className="font-heading text-[32px] leading-none tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
        {value}
      </p>
      <p className="mt-3 font-body text-xs leading-5" style={{ color: "var(--text-2)" }}>
        {hint}
      </p>
    </div>
  );
}

function PaginationControls({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = pageCount(totalItems, pageSize);
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)" }}>
      <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
        Showing {start}-{end} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-heading uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)", background: SOFT_BG, color: "var(--text-2)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <div className="rounded-xl border px-3 py-2 text-[11px] font-heading uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}>
          Page {safePage} / {totalPages}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-heading uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)", background: SOFT_BG, color: "var(--text-2)" }}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CopyableCell({ value, mono = false, className = "" }: { value: string | null; mono?: boolean; className?: string }) {
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
    <td className={`px-4 py-3 align-top ${className}`}>
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
  const [codeEmailResult, setCodeEmailResult] = useState<DispatchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [launchEmailLoading, setLaunchEmailLoading] = useState(false);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [launchEmailInput, setLaunchEmailInput] = useState("");
  const [launchEmailResult, setLaunchEmailResult] = useState<DispatchResult | null>(null);
  const [waitlistPage, setWaitlistPage] = useState(1);
  const [appUsersPage, setAppUsersPage] = useState(1);
  const [volumePage, setVolumePage] = useState(1);

  type UserStats = {
    totalUsers: number;
    newUsers24h: number;
    newUsers7d: number;
    activeUsers24h: number;
  };
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [dailyVolumeSeries, setDailyVolumeSeries] = useState<Array<{ day: string; volumeSol: number }>>([]);
  const [dashboardExporting, setDashboardExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const filteredWaitlist = searchQuery.trim()
    ? waitlistRows.filter(
        (r) =>
          r.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.wallet?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : waitlistRows;

  const waitlistTotalPages = pageCount(filteredWaitlist.length, TABLE_PAGE_SIZE);
  const safeWaitlistPage = Math.min(waitlistPage, waitlistTotalPages);
  const paginatedWaitlist = useMemo(() => {
    const start = (safeWaitlistPage - 1) * TABLE_PAGE_SIZE;
    return filteredWaitlist.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredWaitlist, safeWaitlistPage]);

  const appUsersTotalPages = pageCount(appUsers.length, TABLE_PAGE_SIZE);
  const safeAppUsersPage = Math.min(appUsersPage, appUsersTotalPages);
  const paginatedAppUsers = useMemo(() => {
    const start = (safeAppUsersPage - 1) * TABLE_PAGE_SIZE;
    return appUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [appUsers, safeAppUsersPage]);

  const volumeRows = volumeData?.byWallet ?? [];
  const volumeTotalPages = pageCount(volumeRows.length, TABLE_PAGE_SIZE);
  const safeVolumePage = Math.min(volumePage, volumeTotalPages);
  const paginatedVolumeRows = useMemo(() => {
    const start = (safeVolumePage - 1) * TABLE_PAGE_SIZE;
    return volumeRows.slice(start, start + TABLE_PAGE_SIZE);
  }, [safeVolumePage, volumeRows]);

  const waitlistDailySeries = useMemo(() => {
    const days = 14;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const startMs = now - (days - 1) * dayMs;

    const buckets = Array.from({ length: days }, (_, i) => {
      const ts = startMs + i * dayMs;
      return { day: new Date(ts).toISOString().slice(0, 10), count: 0 };
    });
    const idxByDay = new Map<string, number>();
    buckets.forEach((b, i) => idxByDay.set(b.day, i));

    for (const row of waitlistRows) {
      const ts = row.created_at ? Date.parse(row.created_at) : NaN;
      if (!Number.isFinite(ts) || ts < startMs) continue;
      const dayKey = new Date(ts).toISOString().slice(0, 10);
      const idx = idxByDay.get(dayKey);
      if (typeof idx === "number") buckets[idx].count += 1;
    }
    return buckets;
  }, [waitlistRows]);

  const waitlistInsights = useMemo(() => {
    const withCode = waitlistRows.filter((row) => !!row.access_code).length;
    const activated = waitlistRows.filter((row) => !!row.access_code_used_at).length;
    const contactable = waitlistRows.filter((row) => !!row.email?.trim()).length;
    const last14d = waitlistDailySeries.reduce((sum, item) => sum + item.count, 0);
    const activationRate = withCode > 0 ? (activated / withCode) * 100 : 0;
    const contactCoverage = waitlistRows.length > 0 ? (contactable / waitlistRows.length) * 100 : 0;
    return {
      withCode,
      activated,
      contactable,
      last14d,
      activationRate,
      contactCoverage,
      avgDailySignups: waitlistDailySeries.length > 0 ? last14d / waitlistDailySeries.length : 0,
    };
  }, [waitlistDailySeries, waitlistRows]);

  const usageInsights = useMemo(() => {
    const totalUsers = userStats?.totalUsers ?? 0;
    const newUsers7d = userStats?.newUsers7d ?? 0;
    const activeUsers24h = userStats?.activeUsers24h ?? 0;
    const platform7d = volumeData?.platform7d ?? 0;
    return {
      totalUsers,
      newUsers7d,
      activeUsers24h,
      platform7d,
      visitorMomentum: waitlistInsights.last14d,
      activationShare: waitlistRows.length > 0 ? (totalUsers / waitlistRows.length) * 100 : 0,
      activeShare: totalUsers > 0 ? (activeUsers24h / totalUsers) * 100 : 0,
    };
  }, [userStats, volumeData, waitlistInsights.last14d, waitlistRows.length]);

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
    setWaitlistPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (waitlistPage > waitlistTotalPages) setWaitlistPage(waitlistTotalPages);
  }, [waitlistPage, waitlistTotalPages]);

  useEffect(() => {
    if (appUsersPage > appUsersTotalPages) setAppUsersPage(appUsersTotalPages);
  }, [appUsersPage, appUsersTotalPages]);

  useEffect(() => {
    if (volumePage > volumeTotalPages) setVolumePage(volumeTotalPages);
  }, [volumePage, volumeTotalPages]);

  useEffect(() => {
    const loadSolPrice = async () => {
      setSolPriceUsd(await fetchSolPriceUsd(API_URL));
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

  const loadUserStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/stats`, { credentials: "omit" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load user stats");
      setUserStats(data.data ?? null);
    } catch {
      setUserStats(null);
    }
  }, []);

  const loadDailyVolume = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/volume/daily?days=14`, { credentials: "omit" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load daily volume");
      setDailyVolumeSeries(data.data?.series ?? []);
    } catch {
      setDailyVolumeSeries([]);
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
    if (!hasAccess) return;
    void loadUserStats();
    void loadDailyVolume();
  }, [hasAccess, loadUserStats, loadDailyVolume]);

  useEffect(() => {
    if (!hasAccess || tab !== "app-users") return;
    void loadAppUsers();
  }, [hasAccess, tab, loadAppUsers]);

  useEffect(() => {
    if (!hasAccess || tab !== "volume") return;
    void loadVolume();
  }, [hasAccess, tab, loadVolume]);

  const refresh = () => {
    void loadUserStats();
    void loadDailyVolume();
    if (tab === "waitlist") void loadWaitlist();
    else if (tab === "app-users") void loadAppUsers();
    else if (tab === "volume") void loadVolume();
  };

  const handleExportDashboard = async () => {
    if (!dashboardRef.current) return;
    setDashboardExporting(true);
    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 120));
      const dataUrl = await toPng(dashboardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "transparent",
        skipFonts: false,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `siren-admin-dashboard-${Date.now()}.png`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Dashboard export failed", e);
    } finally {
      setDashboardExporting(false);
    }
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
    setCodeEmailResult(null);
    setSendAllLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/send-all-codes`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCodeEmailResult({
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

  const handleSendLaunchEmail = async () => {
    hapticLight();
    setLaunchEmailResult(null);
    setLaunchEmailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/send-launch-thread-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send launch thread emails");
      setLaunchEmailResult({
        sent: data.sent,
        failed: data.failed,
        skipped: data.skipped,
        total: data.total,
        failedEmails: data.failedEmails ?? [],
        skippedEmails: data.skippedEmails ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send launch thread emails");
    } finally {
      setLaunchEmailLoading(false);
    }
  };

  const handleSendLaunchEmailManual = async () => {
    hapticLight();
    const raw = launchEmailInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (raw.length === 0) {
      setError("Paste one or more emails first.");
      return;
    }
    setLaunchEmailResult(null);
    setLaunchEmailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/waitlist/send-launch-thread-email-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: raw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send launch thread emails");
      setLaunchEmailResult({
        sent: data.sent,
        failed: data.failed,
        skipped: data.skipped,
        total: data.total,
        failedEmails: data.failedEmails ?? [],
        skippedEmails: data.skippedEmails ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send launch thread emails");
    } finally {
      setLaunchEmailLoading(false);
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
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-heading uppercase tracking-[0.18em]" style={{ borderColor: PANEL_BORDER, background: BADGE_BG, color: "var(--accent)" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Launch mode
              </div>
              <h1 className="font-heading text-[30px] leading-none tracking-[-0.04em] md:text-[42px]">Siren Admin</h1>
              <p className="mt-3 max-w-xl font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                Campaign dispatch, waitlist operations, and premium readouts for audience momentum, app usage, and trading activity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Launch thread</p>
                <a href={LAUNCH_THREAD_URL} target="_blank" rel="noreferrer" className="font-heading text-sm hover:opacity-80 transition-opacity" style={{ color: "var(--text-1)" }}>
                  View on X
                </a>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="px-4 py-3 rounded-2xl text-xs font-heading uppercase tracking-[0.14em]"
                style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-default)" }}
              >
                Refresh board
              </button>
            </div>
          </header>

          <div
            ref={dashboardRef}
            className="relative mb-6 overflow-hidden rounded-[32px] border p-5 md:p-6"
            style={{
              background: HERO_BG,
              borderColor: PANEL_BORDER,
              boxShadow: "0 24px 80px color-mix(in srgb, var(--bg-void) 34%, transparent), inset 0 1px 0 color-mix(in srgb, var(--text-1) 6%, transparent)",
            }}
          >
            <div className="pointer-events-none absolute left-[-10%] top-[-18%] h-56 w-56 rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", filter: "blur(60px)" }} />
            <div className="pointer-events-none absolute right-[-6%] top-[10%] h-56 w-56 rounded-full" style={{ background: "color-mix(in srgb, var(--kalshi) 12%, transparent)", filter: "blur(72px)" }} />

            <div className="relative mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-heading uppercase tracking-[0.18em]" style={{ borderColor: PANEL_BORDER, background: BADGE_BG, color: "var(--accent)" }}>
                  <Gauge className="h-3.5 w-3.5" />
                  Dashboard overview
                </div>
                <h2 className="font-heading text-2xl tracking-[-0.04em] md:text-[34px]" style={{ color: "var(--text-1)" }}>
                  Premium pulse on usage, volume, and audience heat.
                </h2>
                <p className="mt-3 max-w-xl font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                  App usage, visitor momentum, and launch readiness in one view. Export-ready for quick team updates.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Audience momentum</p>
                  <p className="font-heading text-lg" style={{ color: "var(--text-1)" }}>
                    {formatCompactNumber(usageInsights.visitorMomentum)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportDashboard}
                  disabled={dashboardExporting}
                  className="px-4 py-3 rounded-2xl text-xs font-heading uppercase tracking-[0.14em] disabled:opacity-50 transition-opacity"
                  style={{ background: SOFT_BG, color: "var(--text-1)", border: `1px solid ${SUBTLE_BORDER}` }}
                >
                  {dashboardExporting ? "Exporting…" : "Export PNG"}
                </button>
              </div>
            </div>

            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total app users"
                value={formatCompactNumber(userStats?.totalUsers)}
                hint={`${formatCompactNumber(userStats?.newUsers7d)} new in the last 7 days`}
                icon={<Users className="h-4 w-4" />}
              />
              <MetricCard
                label="Active users (24h)"
                value={formatCompactNumber(userStats?.activeUsers24h)}
                hint={`${formatPercent(usageInsights.activeShare)} of all users came back in the last day`}
                icon={<Activity className="h-4 w-4" />}
              />
              <MetricCard
                label="Platform volume (7d)"
                value={`${formatSol(volumeData?.platform7d, 1)} SOL`}
                hint={`${formatSol(volumeData?.platformAllTime, 1)} SOL all-time volume`}
                icon={<ChartColumnBig className="h-4 w-4" />}
              />
              <MetricCard
                label="Waitlist activated"
                value={formatPercent(waitlistInsights.activationRate)}
                hint={`${waitlistInsights.activated.toLocaleString()} of ${waitlistInsights.withCode.toLocaleString()} issued codes have converted`}
                icon={<Rocket className="h-4 w-4" />}
              />
            </div>

            <div className="relative mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: SUBTLE_BORDER,
                  background: PANEL_BG,
                }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      App usage
                    </p>
                    <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                      Daily platform volume
                    </h3>
                    <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                      7-day flow: {formatSol(volumeData?.platform7d, 2)} SOL
                    </p>
                  </div>
                  <div className="rounded-2xl border px-3 py-2 text-right" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                    <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>All time</p>
                    <p className="font-heading text-base" style={{ color: "var(--text-1)" }}>{formatSol(volumeData?.platformAllTime, 1)} SOL</p>
                  </div>
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyVolumeSeries}>
                      <defs>
                        <linearGradient id="adminVolumeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="2 8" stroke={GRID_STROKE} />
                      <XAxis dataKey="day" tickFormatter={(value) => (typeof value === "string" ? value.slice(5) : value)} stroke="var(--text-3)" tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-3)" tickFormatter={(value) => `${value}`} tickLine={false} axisLine={false} width={36} />
                      <Tooltip
                        contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${SUBTLE_BORDER}`, borderRadius: 16 }}
                        labelStyle={{ color: "var(--text-2)" }}
                      />
                      <Area type="monotone" dataKey="volumeSol" stroke="var(--accent)" strokeWidth={3} fill="url(#adminVolumeFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: SUBTLE_BORDER,
                  background: PANEL_BG,
                }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Visitor pipeline
                    </p>
                    <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                      Waitlist signups
                    </h3>
                    <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                      {formatCompactNumber(waitlistInsights.last14d)} signups across the last 14 days
                    </p>
                  </div>
                  <div className="rounded-2xl border px-3 py-2 text-right" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                    <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Avg daily</p>
                    <p className="font-heading text-base" style={{ color: "var(--text-1)" }}>{waitlistInsights.avgDailySignups.toFixed(1)}</p>
                  </div>
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waitlistDailySeries}>
                      <defs>
                        <linearGradient id="adminWaitlistFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--border-active)" stopOpacity={0.30} />
                          <stop offset="100%" stopColor="var(--border-active)" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="2 8" stroke={GRID_STROKE} />
                      <XAxis dataKey="day" tickFormatter={(value) => (typeof value === "string" ? value.slice(5) : value)} stroke="var(--text-3)" tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-3)" tickLine={false} axisLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${SUBTLE_BORDER}`, borderRadius: 16 }}
                        labelStyle={{ color: "var(--text-2)" }}
                      />
                      <Area type="monotone" dataKey="count" stroke="var(--border-active)" strokeWidth={3} fill="url(#adminWaitlistFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-[24px] border p-4" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Waitlist coverage</p>
                <p className="mt-2 font-heading text-2xl" style={{ color: "var(--text-1)" }}>{formatPercent(waitlistInsights.contactCoverage)}</p>
                <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                  {waitlistInsights.contactable.toLocaleString()} signups are ready for campaign sends.
                </p>
              </div>
              <div className="rounded-[24px] border p-4" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Launch readiness</p>
                <p className="mt-2 font-heading text-2xl" style={{ color: "var(--text-1)" }}>{formatCompactNumber(waitlistInsights.withCode)}</p>
                <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                  Access codes issued to the queue so far.
                </p>
              </div>
              <div className="rounded-[24px] border p-4" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Usage efficiency</p>
                <p className="mt-2 font-heading text-2xl" style={{ color: "var(--text-1)" }}>{formatPercent(usageInsights.activationShare)}</p>
                <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                  App users relative to the current waitlist size.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-1 rounded-2xl border p-1" style={{ background: SOFT_BG, border: `1px solid ${SUBTLE_BORDER}` }}>
            <button
              type="button"
              onClick={() => { hapticLight(); setTab("waitlist"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading transition-colors"
              style={{
                background: tab === "waitlist" ? TAB_ACTIVE_BG : "transparent",
                color: tab === "waitlist" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "waitlist" ? `1px solid ${SUBTLE_BORDER}` : "1px solid transparent",
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
                background: tab === "app-users" ? TAB_ACTIVE_BG : "transparent",
                color: tab === "app-users" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "app-users" ? `1px solid ${SUBTLE_BORDER}` : "1px solid transparent",
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
                background: tab === "volume" ? TAB_ACTIVE_BG : "transparent",
                color: tab === "volume" ? "var(--text-1)" : "var(--text-3)",
                border: tab === "volume" ? `1px solid ${SUBTLE_BORDER}` : "1px solid transparent",
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
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                    Waitlist + launch campaign
                  </h2>
                  <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Announce the official launch thread, keep failure capture tight, and move the queue forward.
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                  <input
                    type="text"
                    placeholder="Search email, name, wallet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border py-3 pl-9 pr-4 font-body text-xs sm:w-72"
                    style={{ background: SOFT_BG, borderColor: SUBTLE_BORDER, color: "var(--text-1)" }}
                  />
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                <div
                  className="overflow-hidden rounded-[28px] border"
                  style={{
                    borderColor: PANEL_BORDER,
                    background: PANEL_BG,
                    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--text-1) 6%, transparent)",
                  }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[0.95fr,1.05fr]">
                    <div className="relative min-h-[280px]">
                      <img src={LAUNCH_THREAD_IMAGE} alt={LAUNCH_THREAD_TITLE} className="h-full w-full object-cover" />
                      <div className="absolute inset-0" style={{ background: IMAGE_OVERLAY_BG }} />
                    </div>
                    <div className="p-5 md:p-6">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-heading uppercase tracking-[0.18em]" style={{ borderColor: PANEL_BORDER, background: BADGE_BG, color: "var(--accent)" }}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Current campaign
                      </div>
                      <h3 className="font-heading text-[28px] leading-[1.02] tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
                        Official launch thread is live
                      </h3>
                      <p className="mt-3 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                        <span style={{ color: "var(--text-1)" }}>{LAUNCH_THREAD_TITLE}</span> is ready to push. The email tells the waitlist to read it, like it, retweet it, comment on it, and share it with friends.
                      </p>
                      <p className="mt-3 font-body text-sm leading-6" style={{ color: "var(--text-3)" }}>
                        {LAUNCH_THREAD_PREVIEW}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {["Like it", "Retweet it", "Comment on it", "Share with friends"].map((item) => (
                          <span key={item} className="rounded-full border px-3 py-2 text-[11px] font-body" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG, color: "var(--text-2)" }}>
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border p-3" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                          <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Reach ready</p>
                          <p className="mt-2 font-heading text-xl" style={{ color: "var(--text-1)" }}>{waitlistInsights.contactable.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border p-3" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                          <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Codes used</p>
                          <p className="mt-2 font-heading text-xl" style={{ color: "var(--text-1)" }}>{waitlistInsights.activated.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border p-3" style={{ borderColor: SUBTLE_BORDER, background: SOFT_BG }}>
                          <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>Contest cue</p>
                          <p className="mt-2 font-heading text-xl" style={{ color: "var(--accent)" }}>Soon</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <a
                          href={LAUNCH_THREAD_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full px-4 py-3 text-xs font-heading uppercase tracking-[0.14em]"
                          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                        >
                          Open thread
                        </a>
                        <button
                          type="button"
                          onClick={handleSendLaunchEmail}
                          disabled={launchEmailLoading || waitlistRows.length === 0}
                          className="flex items-center gap-2 rounded-full px-4 py-3 text-xs font-heading uppercase tracking-[0.14em] disabled:opacity-50"
                          style={{ background: SOFT_BG, color: "var(--text-1)", border: `1px solid ${SUBTLE_BORDER}` }}
                        >
                          {launchEmailLoading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Mail className="h-4 w-4" />}
                          {launchEmailLoading ? "Sending…" : "Send to all waitlist emails"}
                        </button>
                      </div>
                      <InlineDispatchStatus result={launchEmailResult} label="Launch email result" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border p-5" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Manual resend
                    </p>
                    <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                      Retry the missed launch emails
                    </h3>
                    <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                      Paste failed or skipped addresses here to rerun just the launch announcement.
                    </p>
                    <textarea
                      value={launchEmailInput}
                      onChange={(e) => setLaunchEmailInput(e.target.value)}
                      className="mt-4 min-h-[132px] w-full rounded-2xl border px-4 py-3 font-mono text-[11px]"
                      style={{ background: SOFT_BG, borderColor: SUBTLE_BORDER, color: "var(--text-1)" }}
                      placeholder="lawrencekelvin001@gmail.com&#10;odewumiprecious@gmail.com&#10;kloop058@gmail.com&#10;eokorie1911@gmail.com"
                    />
                    <button
                      type="button"
                      onClick={handleSendLaunchEmailManual}
                      disabled={launchEmailLoading}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-heading uppercase tracking-[0.14em] disabled:opacity-50"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                    >
                      {launchEmailLoading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      Send to pasted emails
                    </button>
                  </div>

                  <DispatchSummary result={launchEmailResult} accentLabel="Launch thread email" />

                  <div className="rounded-[28px] border p-5" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Access code dispatch
                    </p>
                    <h3 className="mt-2 font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                      Keep onboarding moving
                    </h3>
                    <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                      Send fresh access codes to everyone still in the queue.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendAllCodes}
                      disabled={sendAllLoading || waitlistRows.length === 0}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-heading uppercase tracking-[0.14em] disabled:opacity-50"
                      style={{ background: SOFT_BG, color: "var(--text-1)", border: `1px solid ${SUBTLE_BORDER}` }}
                    >
                      {sendAllLoading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Mail className="h-4 w-4" />}
                      {sendAllLoading ? "Sending…" : "Send access codes to all"}
                    </button>
                    <InlineDispatchStatus result={codeEmailResult} label="Access code email result" />
                  </div>

                  <DispatchSummary result={codeEmailResult} accentLabel="Access code email" />
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border min-w-0" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <div className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--border-subtle)" }}>
                  <div>
                    <h3 className="font-heading text-base" style={{ color: "var(--text-1)" }}>Waitlist table</h3>
                    <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                      Paginated so the queue is easier to scan and manage.
                    </p>
                  </div>
                  <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    {filteredWaitlist.length.toLocaleString()} matching signups
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-xs font-body">
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Created</th>
                        <th className="hidden px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider md:table-cell" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Name</th>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Email</th>
                        <th className="hidden px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider xl:table-cell" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Access code</th>
                        <th className="px-4 py-3 border-b w-24 font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedWaitlist.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-sm" colSpan={6} style={{ color: "var(--text-3)" }}>
                            {searchQuery.trim() ? "No matches for your search." : "No waitlist signups yet."}
                          </td>
                        </tr>
                      ) : (
                        paginatedWaitlist.map((row, idx) => (
                          <tr
                            key={row.id}
                            className="border-t transition-colors hover:bg-[var(--bg-elevated)]"
                            style={{
                              borderColor: "var(--border-subtle)",
                              background: idx % 2 === 0 ? "color-mix(in srgb, var(--bg-surface) 88%, transparent)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{new Date(row.created_at).toLocaleString()}</td>
                            <td className="hidden px-4 py-3 md:table-cell">{row.name || "—"}</td>
                            <td className="px-4 py-3">{row.email}</td>
                            <CopyableCell value={row.wallet} mono className="hidden xl:table-cell" />
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
                <PaginationControls page={safeWaitlistPage} totalItems={filteredWaitlist.length} pageSize={TABLE_PAGE_SIZE} onPageChange={setWaitlistPage} />
              </div>
            </section>
          )}

          {tab === "volume" && (
            <section className="min-w-0 overflow-hidden">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                    Volume intelligence
                  </h2>
                  <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    7d, 30d, and all-time flow, with the leaderboard paginated for easier review.
                  </p>
                </div>
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  {volumeRows.length.toLocaleString()} wallets tracked
                </p>
              </div>
              {volumeLoading ? (
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>Loading…</p>
              ) : volumeData ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                    <p className="font-body text-[11px] mb-1" style={{ color: "var(--text-3)" }}>Platform volume</p>
                    <p className="font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                      7d: {(volumeData.platform7d ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                    </p>
                    <p className="font-mono text-sm tabular-nums mt-1" style={{ color: "var(--text-2)" }}>
                      30d: {(volumeData.platform30d ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                    </p>
                    <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
                      All-time: {(volumeData.platformAllTime ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                      {solPriceUsd > 0 && (
                        <span className="text-[11px] ml-1" style={{ color: "var(--text-3)" }}>
                          (≈${(((volumeData.platformAllTime ?? 0) * solPriceUsd) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left text-xs font-body">
                        <thead>
                          <tr style={{ background: "var(--bg-elevated)" }}>
                            <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                            <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>7d (SOL)</th>
                            <th className="hidden px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider md:table-cell" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>30d (SOL)</th>
                            <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>All-time (SOL)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedVolumeRows.length === 0 ? (
                            <tr>
                              <td className="px-4 py-6 text-center text-sm" colSpan={4} style={{ color: "var(--text-3)" }}>
                                No volume logged yet. Volume is logged when users complete swaps.
                              </td>
                            </tr>
                          ) : (
                            paginatedVolumeRows.map((row, idx) => {
                              const v7 = row.volume7d ?? 0;
                              const v30 = row.volume30d ?? 0;
                              const vAll = row.volumeAllTime ?? v7;
                              return (
                                <tr
                                  key={row.wallet}
                                  className="border-t transition-colors hover:bg-[var(--bg-elevated)]"
                                  style={{
                                    borderColor: "var(--border-subtle)",
                                    background: idx % 2 === 0 ? "color-mix(in srgb, var(--bg-surface) 88%, transparent)" : "transparent",
                                  }}
                                >
                                  <CopyableCell value={row.wallet} mono />
                                  <td className="px-4 py-3 font-mono tabular-nums" style={{ color: "var(--text-2)" }}>
                                    {v7.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                                  </td>
                                  <td className="hidden px-4 py-3 font-mono tabular-nums md:table-cell" style={{ color: "var(--text-2)" }}>
                                    {v30.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                                  </td>
                                  <td className="px-4 py-3 font-mono tabular-nums" style={{ color: "var(--text-2)" }}>
                                    {vAll.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                                    {solPriceUsd > 0 && (
                                      <span className="text-[10px] ml-1" style={{ color: "var(--text-3)" }}>
                                        (≈${((vAll * solPriceUsd) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
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
                    <PaginationControls page={safeVolumePage} totalItems={volumeRows.length} pageSize={TABLE_PAGE_SIZE} onPageChange={setVolumePage} />
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {tab === "app-users" && (
            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
                    App users
                  </h2>
                  <p className="mt-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Wallet-connected users with a cleaner table layout and pagination.
                  </p>
                </div>
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  {appUsers.length.toLocaleString()} users loaded
                </p>
              </div>
              <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs font-body">
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Created</th>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Last seen</th>
                        <th className="px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Wallet</th>
                        <th className="hidden px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider md:table-cell" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Source</th>
                        <th className="hidden px-4 py-3 border-b font-heading text-[11px] uppercase tracking-wider lg:table-cell" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAppUsers.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-sm" colSpan={5} style={{ color: "var(--text-3)" }}>
                            No app users yet.
                          </td>
                        </tr>
                      ) : (
                        paginatedAppUsers.map((row, idx) => (
                          <tr
                            key={row.id}
                            className="border-t transition-colors hover:bg-[var(--bg-elevated)]"
                            style={{
                              borderColor: "var(--border-subtle)",
                              background: idx % 2 === 0 ? "color-mix(in srgb, var(--bg-surface) 88%, transparent)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{new Date(row.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "—"}</td>
                            <CopyableCell value={row.wallet} mono />
                            <td className="hidden px-4 py-3 md:table-cell">{row.signup_source || "—"}</td>
                            <CopyableCell value={row.country} className="hidden lg:table-cell" />
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls page={safeAppUsersPage} totalItems={appUsers.length} pageSize={TABLE_PAGE_SIZE} onPageChange={setAppUsersPage} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
