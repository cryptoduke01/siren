"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PasscodeDigits } from "@/components/PasscodeDigits";
import { AdminNav } from "@/components/AdminNav";
import { API_URL } from "@/lib/apiUrl";
import { getAdminPasscodeHeaders } from "@/lib/requestAuth";

const ADMIN_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || "";
const STORAGE_KEY = "siren-admin-pass-ok";
const PANEL_BG = "var(--bg-surface)";
const PANEL_BORDER = "var(--border-subtle)";
const GRID_STROKE = "color-mix(in srgb, var(--border-subtle) 72%, transparent)";

type DashboardAlert = {
  tone: "red" | "yellow" | "green";
  label: string;
  active: boolean;
  detail: string;
};

type SeriesPoint = {
  day: string;
  value: number;
};

type TopMarket = {
  market: string;
  venue: string;
  count: number;
};

type TopSize = {
  amount: number;
  label: string;
  count: number;
};

type DashboardUserRow = {
  id: string;
  wallet: string | null;
  email: string | null;
  name: string | null;
  signupDate: string | null;
  lastActive: string | null;
  signupSource: string | null;
  country: string | null;
  tradesAttempted: number;
  tradesSucceeded: number;
  volumeUsd: number;
};

type WaitlistUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  wallet: string | null;
  signupDate: string | null;
  accessCode: string | null;
  accessCodeIssued: boolean;
  accessCodeUsedAt: string | null;
  converted: boolean;
};

type CampaignPreset = {
  id: "access_codes" | "launch_thread" | "execution_risk_update" | "trading_live" | "leaderboard_spotlight";
  label: string;
  description: string;
  endpoint: string;
  audienceLabel: string;
  eligibleContacts: number;
  recommended: boolean;
};

type TractionDashboard = {
  generatedAt: string;
  alerts: DashboardAlert[];
  header: {
    totalRegisteredUsers: number;
    activeUsers7d: number;
    activeUsers24h: number;
    totalTradesAttempted: number;
    totalTradesSuccessful: number;
    platformVolumeUsd: number;
  };
  allTime: {
    waitlistUsers: number;
    appUsers: number;
    reachableContacts: number;
    convertedWaitlistUsers: number;
    totalMarketViews: number;
    totalTradeFailures: number;
  };
  growth: {
    dailySignups: SeriesPoint[];
    cumulativeUsers: SeriesPoint[];
    waitlistUsers: number;
    convertedUsers: number;
    waitlistPending: number;
  };
  engagement: {
    openedTerminalNeverTraded: number;
    attemptedAtLeastOneTrade: number;
    attemptedThreePlusTrades: number;
    signupToFirstTradeDropoffRate: number;
  };
  tradeActivity: {
    attemptedToday: number;
    succeededToday: number;
    failedToday: number;
    topBrowsedMarkets: TopMarket[];
    topAttemptedSizes: TopSize[];
    browsedMarketsSource: "market_views" | "trade_attempts_fallback";
  };
  venueBreakdown: {
    kalshiAttempts: number;
    polymarketAttempts: number;
    leader: "kalshi" | "polymarket" | "tie" | "none";
  };
  retention: {
    day1Retention: number;
    day7Retention: number;
    activeThisWeekAlsoLastWeek: number;
    estimatedFromLastSeen: boolean;
  };
  audience: {
    emailConfigured: boolean;
    reachableContacts: number;
    waitlistOnlyContacts: number;
    appOnlyContacts: number;
    bothSourceContacts: number;
    waitlistWithEmail: number;
    waitlistMissingCodes: number;
    waitlistIssuedCodes: number;
    waitlistRedeemedCodes: number;
    appUsersWithEmail: number;
    activeAppContacts7d: number;
    dormantAppContacts14d: number;
  };
  campaigns: {
    presets: CampaignPreset[];
    gapSummary: string;
  };
  appUsers: DashboardUserRow[];
  waitlistUsers: WaitlistUserRow[];
};

type SortKey = "wallet" | "email" | "signupDate" | "lastActive" | "tradesAttempted" | "tradesSucceeded" | "volumeUsd";
type SortDirection = "asc" | "desc";

function formatCompactNumber(value: number | null | undefined, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(value: string) {
  return value.slice(5);
}

function compareStrings(left: string | null | undefined, right: string | null | undefined, direction: SortDirection) {
  const leftValue = (left ?? "").toLowerCase();
  const rightValue = (right ?? "").toLowerCase();
  if (leftValue === rightValue) return 0;
  return direction === "asc" ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
}

function compareNumbers(left: number, right: number, direction: SortDirection) {
  return direction === "asc" ? left - right : right - left;
}

function compareDates(left: string | null | undefined, right: string | null | undefined, direction: SortDirection) {
  const leftValue = left ? Date.parse(left) : 0;
  const rightValue = right ? Date.parse(right) : 0;
  return compareNumbers(Number.isFinite(leftValue) ? leftValue : 0, Number.isFinite(rightValue) ? rightValue : 0, direction);
}

function tooltipStyle() {
  return {
    background: "var(--bg-base)",
    border: `1px solid ${PANEL_BORDER}`,
    borderRadius: 16,
    color: "var(--text-1)",
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border p-4" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
      <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="mt-3 font-heading text-[28px] leading-none tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 font-body text-xs leading-5" style={{ color: "var(--text-2)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border p-5" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
      <div className="mb-5">
        <h2 className="font-heading text-xl tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricRow({
  label,
  value,
  tone = "var(--text-1)",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t py-3 first:border-t-0 first:pt-0 last:pb-0" style={{ borderColor: PANEL_BORDER }}>
      <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function AlertBadge({ alert }: { alert: DashboardAlert }) {
  const styles =
    alert.tone === "red"
      ? {
          borderColor: "color-mix(in srgb, var(--down) 28%, transparent)",
          background: "color-mix(in srgb, var(--down) 10%, var(--bg-surface))",
          color: "var(--down)",
        }
      : alert.tone === "yellow"
        ? {
            borderColor: "color-mix(in srgb, #f2c94c 32%, transparent)",
            background: "color-mix(in srgb, #f2c94c 10%, var(--bg-surface))",
            color: "#d6a41f",
          }
        : {
            borderColor: "color-mix(in srgb, var(--up) 28%, transparent)",
            background: "color-mix(in srgb, var(--up) 10%, var(--bg-surface))",
            color: "var(--up)",
          };

  return (
    <div className="rounded-2xl border px-3 py-2" style={styles}>
      <p className="font-heading text-[10px] uppercase tracking-[0.16em]">
        {alert.label}
      </p>
      <p className="mt-1 font-body text-xs leading-5" style={{ color: alert.active ? styles.color : "var(--text-2)" }}>
        {alert.detail}
      </p>
    </div>
  );
}

function CampaignCard({
  campaign,
  emailConfigured,
  busy,
  onRun,
}: {
  campaign: CampaignPreset;
  emailConfigured: boolean;
  busy: boolean;
  onRun: (campaign: CampaignPreset) => void;
}) {
  const disabled = !emailConfigured || campaign.eligibleContacts === 0 || busy;

  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg tracking-[-0.03em]" style={{ color: "var(--text-1)" }}>
            {campaign.label}
          </p>
          <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
            {campaign.description}
          </p>
        </div>
        {campaign.recommended ? (
          <span
            className="rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em]"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              background: "color-mix(in srgb, var(--accent) 12%, var(--bg-surface))",
              color: "var(--accent)",
            }}
          >
            Recommended
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-1">
        <MetricRow label="Audience" value={campaign.audienceLabel} />
        <MetricRow label="Eligible contacts" value={formatCompactNumber(campaign.eligibleContacts)} />
      </div>
      <button
        type="button"
        onClick={() => onRun(campaign)}
        disabled={disabled}
        className="mt-4 w-full rounded-2xl border px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "var(--bg-elevated)", borderColor: PANEL_BORDER, color: "var(--text-1)" }}
      >
        {busy ? "Sending..." : !emailConfigured ? "Email not configured" : campaign.eligibleContacts === 0 ? "No audience yet" : "Send campaign"}
      </button>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className="font-heading text-[11px] uppercase tracking-[0.14em]"
        style={{ color: isActive ? "var(--text-1)" : "var(--text-3)" }}
      >
        {label} {isActive ? (direction === "asc" ? "↑" : "↓") : ""}
      </button>
    </th>
  );
}

export default function AdminPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<TractionDashboard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [waitlistSearchQuery, setWaitlistSearchQuery] = useState("");
  const [campaignBusyId, setCampaignBusyId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("volumeUsd");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const deferredSearch = useDeferredValue(searchQuery);
  const deferredWaitlistSearch = useDeferredValue(waitlistSearchQuery);
  const adminHeaders = useMemo(() => getAdminPasscodeHeaders(ADMIN_PASSCODE), []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/traction`, { headers: adminHeaders, credentials: "omit" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load traction dashboard.");
      setDashboard(payload.data ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load traction dashboard.");
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setHasAccess(true);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    void loadDashboard();
  }, [hasAccess, loadDashboard]);

  const handlePassSubmit = () => {
    if (!ADMIN_PASSCODE) {
      setError("Admin passcode not configured. Set NEXT_PUBLIC_ADMIN_PASSCODE in env.");
      return;
    }
    if (input.trim() !== ADMIN_PASSCODE) {
      setError("Incorrect passcode.");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setInput("");
    setError(null);
    setHasAccess(true);
  };

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "wallet" || nextKey === "email" ? "asc" : "desc");
  };

  const filteredAppUsers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const rows = query
      ? (dashboard?.appUsers ?? []).filter((row) =>
          [row.wallet ?? "", row.email ?? "", row.name ?? ""].some((value) => value.toLowerCase().includes(query))
        )
      : [...(dashboard?.appUsers ?? [])];

    rows.sort((left, right) => {
      if (sortKey === "wallet") return compareStrings(left.wallet, right.wallet, sortDirection);
      if (sortKey === "email") return compareStrings(left.email, right.email, sortDirection);
      if (sortKey === "signupDate") return compareDates(left.signupDate, right.signupDate, sortDirection);
      if (sortKey === "lastActive") return compareDates(left.lastActive, right.lastActive, sortDirection);
      if (sortKey === "tradesAttempted") return compareNumbers(left.tradesAttempted, right.tradesAttempted, sortDirection);
      if (sortKey === "tradesSucceeded") return compareNumbers(left.tradesSucceeded, right.tradesSucceeded, sortDirection);
      return compareNumbers(left.volumeUsd, right.volumeUsd, sortDirection);
    });

    return rows;
  }, [dashboard?.appUsers, deferredSearch, sortDirection, sortKey]);

  const filteredWaitlistUsers = useMemo(() => {
    const query = deferredWaitlistSearch.trim().toLowerCase();
    const rows = [...(dashboard?.waitlistUsers ?? [])];
    if (!query) return rows;
    return rows.filter((row) =>
      [row.email ?? "", row.wallet ?? "", row.name ?? "", row.accessCode ?? ""].some((value) => value.toLowerCase().includes(query))
    );
  }, [dashboard?.waitlistUsers, deferredWaitlistSearch]);

  const runCampaign = useCallback(
    async (campaign: CampaignPreset) => {
      if (!window.confirm(`Send "${campaign.label}" to ${campaign.audienceLabel.toLowerCase()} now?`)) return;
      setCampaignBusyId(campaign.id);
      setCampaignStatus(null);
      setError(null);

      try {
        const res = await fetch(`${API_URL}${campaign.endpoint}`, {
          method: "POST",
          headers: adminHeaders,
          credentials: "omit",
        });
        const payload = await res.json();
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error || `Failed to send ${campaign.label.toLowerCase()}.`);
        }

        const summary =
          typeof payload.sent === "number"
            ? `${campaign.label}: sent ${payload.sent}/${payload.total ?? payload.sent}, failed ${payload.failed ?? 0}, skipped ${payload.skipped ?? 0}.`
            : `${campaign.label} triggered successfully.`;

        setCampaignStatus(summary);
        await loadDashboard();
      } catch (campaignError) {
        setError(campaignError instanceof Error ? campaignError.message : "Failed to run campaign.");
      } finally {
        setCampaignBusyId(null);
      }
    },
    [adminHeaders, loadDashboard],
  );

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-void)" }}>
        <div className="w-full max-w-sm rounded-3xl border px-6 py-8" style={{ background: PANEL_BG, borderColor: PANEL_BORDER }}>
          <h1 className="font-heading text-xl" style={{ color: "var(--text-1)" }}>
            Admin access
          </h1>
          <p className="mt-2 font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
            Enter the passcode to open the traction board.
          </p>
          <div className="mt-6">
            <PasscodeDigits
              value={input}
              onChange={setInput}
              onSubmit={handlePassSubmit}
              error={error}
              label="Enter the 6-digit passcode to continue"
              submitLabel="Enter"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-void)", color: "var(--text-1)" }}>
      <AdminNav />
      <main className="px-4 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-heading text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Traction dashboard
              </p>
              <h1 className="mt-2 font-heading text-[34px] leading-none tracking-[-0.05em]" style={{ color: "var(--text-1)" }}>
                Are we growing or not?
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-6" style={{ color: "var(--text-2)" }}>
                Registered users, trade attempts, successful trades, retention, and the users behind the numbers.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {(dashboard?.alerts ?? []).map((alert) => (
                  <AlertBadge key={alert.label} alert={alert} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                  {dashboard?.generatedAt ? `Updated ${formatDateTime(dashboard.generatedAt)}` : "Waiting for data"}
                </p>
                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  className="rounded-2xl border px-4 py-2 text-[11px] font-heading uppercase tracking-[0.14em]"
                  style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: "var(--text-1)" }}
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border px-4 py-3 font-body text-sm" style={{ background: PANEL_BG, borderColor: PANEL_BORDER, color: "var(--down)" }}>
              {error}
            </div>
          ) : null}

          <div className="sticky top-0 z-20 -mx-4 border-y px-4 py-4 backdrop-blur" style={{ background: "color-mix(in srgb, var(--bg-void) 88%, transparent)", borderColor: PANEL_BORDER }}>
            <div className="mx-auto max-w-7xl grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Total registered users" value={formatCompactNumber(dashboard?.header.totalRegisteredUsers)} />
              <StatCard label="Active users last 7 days" value={formatCompactNumber(dashboard?.header.activeUsers7d)} />
              <StatCard label="Active users last 24 hours" value={formatCompactNumber(dashboard?.header.activeUsers24h)} />
              <StatCard label="Total trades attempted" value={formatCompactNumber(dashboard?.header.totalTradesAttempted)} />
              <StatCard label="Total trades successful" value={formatCompactNumber(dashboard?.header.totalTradesSuccessful)} />
              <StatCard label="Platform volume in USD" value={formatUsd(dashboard?.header.platformVolumeUsd)} />
            </div>
          </div>

          <SectionCard
            title="All-time footprint"
            subtitle="Permanent totals across user acquisition, audience reach, browsing, and failed trade attempts."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Waitlist users" value={formatCompactNumber(dashboard?.allTime.waitlistUsers)} />
              <StatCard label="App users" value={formatCompactNumber(dashboard?.allTime.appUsers)} />
              <StatCard label="Reachable contacts" value={formatCompactNumber(dashboard?.allTime.reachableContacts)} />
              <StatCard label="Converted waitlist users" value={formatCompactNumber(dashboard?.allTime.convertedWaitlistUsers)} />
              <StatCard label="Market views tracked" value={formatCompactNumber(dashboard?.allTime.totalMarketViews)} />
              <StatCard label="Trade failures logged" value={formatCompactNumber(dashboard?.allTime.totalTradeFailures)} />
            </div>
          </SectionCard>

          <SectionCard
            title="User growth"
            subtitle="Daily signups and cumulative registered users over the last 30 days, plus the waitlist-to-conversion split."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_320px]">
              <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                  Daily signups
                </p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard?.growth.dailySignups ?? []}>
                      <CartesianGrid vertical={false} strokeDasharray="2 8" stroke={GRID_STROKE} />
                      <XAxis dataKey="day" tickFormatter={formatDayLabel} tickLine={false} axisLine={false} stroke="var(--text-3)" />
                      <YAxis tickLine={false} axisLine={false} stroke="var(--text-3)" width={28} />
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Bar dataKey="value" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                  Cumulative user growth
                </p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboard?.growth.cumulativeUsers ?? []}>
                      <CartesianGrid vertical={false} strokeDasharray="2 8" stroke={GRID_STROKE} />
                      <XAxis dataKey="day" tickFormatter={formatDayLabel} tickLine={false} axisLine={false} stroke="var(--text-3)" />
                      <YAxis tickLine={false} axisLine={false} stroke="var(--text-3)" width={28} />
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Line type="monotone" dataKey="value" stroke="var(--border-active)" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                  Waitlist vs converted
                </p>
                <p className="mt-3 font-heading text-[28px] leading-none tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
                  {formatPercent(
                    dashboard ? (dashboard.growth.convertedUsers / Math.max(dashboard.growth.waitlistUsers, 1)) * 100 : 0,
                  )}
                </p>
                <div className="mt-4 overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
                  <div
                    className="h-3"
                    style={{
                      width: `${dashboard ? (dashboard.growth.convertedUsers / Math.max(dashboard.growth.waitlistUsers, 1)) * 100 : 0}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div className="mt-4 space-y-1">
                  <MetricRow label="Waitlist users" value={formatCompactNumber(dashboard?.growth.waitlistUsers)} />
                  <MetricRow label="Converted users" value={formatCompactNumber(dashboard?.growth.convertedUsers)} tone="var(--accent)" />
                  <MetricRow label="Still waiting" value={formatCompactNumber(dashboard?.growth.waitlistPending)} />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Engagement"
              subtitle="Who signed up, who opened the product, and who actually started trading."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Opened terminal, never traded" value={formatCompactNumber(dashboard?.engagement.openedTerminalNeverTraded)} />
                <StatCard label="Attempted at least 1 trade" value={formatCompactNumber(dashboard?.engagement.attemptedAtLeastOneTrade)} />
                <StatCard label="Attempted 3+ trades" value={formatCompactNumber(dashboard?.engagement.attemptedThreePlusTrades)} hint="Retained users by repeated trade behavior." />
                <StatCard label="Signup to first trade drop-off" value={formatPercent(dashboard?.engagement.signupToFirstTradeDropoffRate)} />
              </div>
            </SectionCard>

            <SectionCard
              title="Trade activity"
              subtitle="Today’s attempt funnel, the markets drawing attention, and the sizes users try first."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label="Trades attempted today" value={formatCompactNumber(dashboard?.tradeActivity.attemptedToday)} />
                    <StatCard label="Trades succeeded today" value={formatCompactNumber(dashboard?.tradeActivity.succeededToday)} />
                    <StatCard label="Trades failed today" value={formatCompactNumber(dashboard?.tradeActivity.failedToday)} />
                  </div>
                  <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                    <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Most active markets being browsed
                    </p>
                    <div className="mt-3">
                      {(dashboard?.tradeActivity.topBrowsedMarkets ?? []).length === 0 ? (
                        <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
                          No tracked market views yet.
                        </p>
                      ) : (
                        (dashboard?.tradeActivity.topBrowsedMarkets ?? []).map((row) => (
                          <MetricRow
                            key={`${row.venue}-${row.market}`}
                            label={`${row.market} (${row.venue})`}
                            value={formatCompactNumber(row.count)}
                          />
                        ))
                      )}
                    </div>
                    <p className="mt-3 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                      {dashboard?.tradeActivity.browsedMarketsSource === "market_views"
                        ? "Direct market-view telemetry."
                        : "Using trade-attempt fallback until market-view telemetry fills in."}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                    Most attempted trade sizes
                  </p>
                  <div className="mt-3">
                    {(dashboard?.tradeActivity.topAttemptedSizes ?? []).length === 0 ? (
                      <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
                        No trade-size pattern yet.
                      </p>
                    ) : (
                      (dashboard?.tradeActivity.topAttemptedSizes ?? []).map((row) => (
                        <MetricRow key={`${row.label}-${row.count}`} label={row.label} value={`${formatCompactNumber(row.count)} attempts`} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Venue breakdown"
              subtitle="Which venue is getting more real trade attempts right now."
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                      Kalshi activity
                    </span>
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--kalshi)" }}>
                      {formatCompactNumber(dashboard?.venueBreakdown.kalshiAttempts)}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
                    <div
                      className="h-3"
                      style={{
                        width: `${dashboard ? (dashboard.venueBreakdown.kalshiAttempts / Math.max(dashboard.venueBreakdown.kalshiAttempts + dashboard.venueBreakdown.polymarketAttempts, 1)) * 100 : 0}%`,
                        background: "var(--kalshi)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                      Polymarket activity
                    </span>
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--polymarket)" }}>
                      {formatCompactNumber(dashboard?.venueBreakdown.polymarketAttempts)}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
                    <div
                      className="h-3"
                      style={{
                        width: `${dashboard ? (dashboard.venueBreakdown.polymarketAttempts / Math.max(dashboard.venueBreakdown.kalshiAttempts + dashboard.venueBreakdown.polymarketAttempts, 1)) * 100 : 0}%`,
                        background: "var(--polymarket)",
                      }}
                    />
                  </div>
                </div>
                <StatCard
                  label="Which venue has more attempted trades"
                  value={
                    !dashboard
                      ? "—"
                      : dashboard.venueBreakdown.leader === "none"
                        ? "No leader"
                        : dashboard.venueBreakdown.leader === "tie"
                          ? "Tie"
                          : dashboard.venueBreakdown.leader === "kalshi"
                            ? "Kalshi"
                            : "Polymarket"
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Retention"
              subtitle="Did users come back after signup, and did any users stay active week over week."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Day 1 retention" value={formatPercent(dashboard?.retention.day1Retention)} />
                <StatCard label="Day 7 retention" value={formatPercent(dashboard?.retention.day7Retention)} />
                <StatCard label="Active this week and last week" value={formatCompactNumber(dashboard?.retention.activeThisWeekAlsoLastWeek)} />
              </div>
              {dashboard?.retention.estimatedFromLastSeen ? (
                <p className="mt-4 font-body text-[11px] leading-5" style={{ color: "var(--text-3)" }}>
                  Retention uses tracked activity when available and falls back to `last_seen_at` for older users.
                </p>
              ) : null}
            </SectionCard>
          </div>

          <SectionCard
            title="Audience and email dissemination"
            subtitle="Code-defined campaigns live in the backend and surface here automatically with one-click sends."
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard
                    label="Email delivery"
                    value={dashboard?.audience.emailConfigured ? "Configured" : "Offline"}
                    hint={dashboard?.audience.emailConfigured ? "Resend is available for campaign sends." : "Set RESEND_API_KEY and sender envs."}
                  />
                  <StatCard label="Reachable contacts" value={formatCompactNumber(dashboard?.audience.reachableContacts)} />
                  <StatCard label="Waitlist-only contacts" value={formatCompactNumber(dashboard?.audience.waitlistOnlyContacts)} />
                  <StatCard label="App-only contacts" value={formatCompactNumber(dashboard?.audience.appOnlyContacts)} />
                  <StatCard label="Overlap contacts" value={formatCompactNumber(dashboard?.audience.bothSourceContacts)} />
                  <StatCard label="Active app contacts 7d" value={formatCompactNumber(dashboard?.audience.activeAppContacts7d)} />
                </div>
                <div className="rounded-3xl border p-4" style={{ borderColor: PANEL_BORDER }}>
                  <p className="font-body text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                    Audience readiness
                  </p>
                  <div className="mt-3 space-y-1">
                    <MetricRow label="Waitlist emails" value={formatCompactNumber(dashboard?.audience.waitlistWithEmail)} />
                    <MetricRow label="Missing access codes" value={formatCompactNumber(dashboard?.audience.waitlistMissingCodes)} tone="var(--down)" />
                    <MetricRow label="Issued access codes" value={formatCompactNumber(dashboard?.audience.waitlistIssuedCodes)} />
                    <MetricRow label="Redeemed access codes" value={formatCompactNumber(dashboard?.audience.waitlistRedeemedCodes)} tone="var(--accent)" />
                    <MetricRow label="App users with email" value={formatCompactNumber(dashboard?.audience.appUsersWithEmail)} />
                    <MetricRow label="Dormant app contacts 14d" value={formatCompactNumber(dashboard?.audience.dormantAppContacts14d)} />
                  </div>
                  <p className="mt-4 font-body text-xs leading-6" style={{ color: "var(--text-3)" }}>
                    {dashboard?.campaigns.gapSummary ?? "Campaign audience summary unavailable."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {campaignStatus ? (
                  <div className="rounded-3xl border px-4 py-3 font-body text-sm" style={{ borderColor: PANEL_BORDER, background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))", color: "var(--text-1)" }}>
                    {campaignStatus}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  {(dashboard?.campaigns.presets ?? []).map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      emailConfigured={Boolean(dashboard?.audience.emailConfigured)}
                      busy={campaignBusyId === campaign.id}
                      onRun={runCampaign}
                    />
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="App users"
              subtitle="All registered app users with search and sortable trade columns."
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                  {formatCompactNumber(filteredAppUsers.length)} users shown
                </p>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search wallet, email, or name"
                  className="w-full rounded-2xl border px-4 py-3 font-body text-sm lg:w-80"
                  style={{ background: "var(--bg-elevated)", borderColor: PANEL_BORDER, color: "var(--text-1)" }}
                />
              </div>

              <div className="overflow-hidden rounded-3xl border" style={{ borderColor: PANEL_BORDER }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs font-body">
                    <thead style={{ background: "var(--bg-elevated)" }}>
                      <tr>
                        <SortHeader label="Wallet" sortKey="wallet" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Signup date" sortKey="signupDate" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Last active" sortKey="lastActive" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Trades attempted" sortKey="tradesAttempted" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Trades succeeded" sortKey="tradesSucceeded" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                        <SortHeader label="Volume" sortKey="volumeUsd" activeKey={sortKey} direction={sortDirection} onClick={toggleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
                            {searchQuery.trim() ? "No app users match that search." : "No registered app users yet."}
                          </td>
                        </tr>
                      ) : (
                        filteredAppUsers.map((row, index) => (
                          <tr
                            key={row.id}
                            className="border-t"
                            style={{
                              borderColor: PANEL_BORDER,
                              background: index % 2 === 0 ? "color-mix(in srgb, var(--bg-surface) 92%, transparent)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-3 font-mono text-[11px]" style={{ color: row.wallet ? "var(--text-1)" : "var(--text-3)" }}>
                              {row.wallet ?? "—"}
                            </td>
                            <td className="px-4 py-3" style={{ color: row.email ? "var(--text-1)" : "var(--text-3)" }}>
                              <div>{row.email ?? "—"}</div>
                              {row.name ? (
                                <div className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                                  {row.name}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>
                              {formatDateTime(row.signupDate)}
                            </td>
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>
                              {formatDateTime(row.lastActive)}
                            </td>
                            <td className="px-4 py-3 font-mono" style={{ color: "var(--text-1)" }}>
                              {row.tradesAttempted.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-mono" style={{ color: "var(--text-1)" }}>
                              {row.tradesSucceeded.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-mono" style={{ color: "var(--text-1)" }}>
                              {formatUsd(row.volumeUsd)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Waitlist users"
              subtitle="Raw waitlist entries with email reach, wallet linkage, and access-code status."
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                  {formatCompactNumber(filteredWaitlistUsers.length)} waitlist users shown
                </p>
                <input
                  type="text"
                  value={waitlistSearchQuery}
                  onChange={(event) => setWaitlistSearchQuery(event.target.value)}
                  placeholder="Search email, wallet, name, or code"
                  className="w-full rounded-2xl border px-4 py-3 font-body text-sm lg:w-80"
                  style={{ background: "var(--bg-elevated)", borderColor: PANEL_BORDER, color: "var(--text-1)" }}
                />
              </div>

              <div className="overflow-hidden rounded-3xl border" style={{ borderColor: PANEL_BORDER }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs font-body">
                    <thead style={{ background: "var(--bg-elevated)" }}>
                      <tr>
                        <th className="px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          Email
                        </th>
                        <th className="px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          Wallet
                        </th>
                        <th className="px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          Signup date
                        </th>
                        <th className="px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          Access code
                        </th>
                        <th className="px-4 py-3 font-heading text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWaitlistUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
                            {waitlistSearchQuery.trim() ? "No waitlist users match that search." : "No waitlist users yet."}
                          </td>
                        </tr>
                      ) : (
                        filteredWaitlistUsers.map((row, index) => (
                          <tr
                            key={row.id}
                            className="border-t"
                            style={{
                              borderColor: PANEL_BORDER,
                              background: index % 2 === 0 ? "color-mix(in srgb, var(--bg-surface) 92%, transparent)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-3" style={{ color: row.email ? "var(--text-1)" : "var(--text-3)" }}>
                              <div>{row.email ?? "—"}</div>
                              {row.name ? (
                                <div className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                                  {row.name}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px]" style={{ color: row.wallet ? "var(--text-1)" : "var(--text-3)" }}>
                              {row.wallet ?? "—"}
                            </td>
                            <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>
                              {formatDateTime(row.signupDate)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px]" style={{ color: row.accessCode ? "var(--text-1)" : "var(--text-3)" }}>
                              {row.accessCode ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em]"
                                style={{
                                  borderColor: row.converted
                                    ? "color-mix(in srgb, var(--up) 28%, transparent)"
                                    : row.accessCodeIssued
                                      ? "color-mix(in srgb, #f2c94c 32%, transparent)"
                                      : "color-mix(in srgb, var(--down) 28%, transparent)",
                                  background: row.converted
                                    ? "color-mix(in srgb, var(--up) 10%, var(--bg-surface))"
                                    : row.accessCodeIssued
                                      ? "color-mix(in srgb, #f2c94c 10%, var(--bg-surface))"
                                      : "color-mix(in srgb, var(--down) 10%, var(--bg-surface))",
                                  color: row.converted ? "var(--up)" : row.accessCodeIssued ? "#d6a41f" : "var(--down)",
                                }}
                              >
                                {row.converted ? "Redeemed" : row.accessCodeIssued ? "Code issued" : "No code"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
    </div>
  );
}
