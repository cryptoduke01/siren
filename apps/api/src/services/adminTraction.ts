import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendEmail } from "./email.js";
import { buildEmailCampaignPresets } from "./emailCampaigns.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_ROWS = 10_000;

type WaitlistRow = {
  id: string;
  created_at: string | null;
  access_code: string | null;
  access_code_used_at: string | null;
  email: string | null;
  wallet: string | null;
  name: string | null;
};

type UserRow = {
  id: string;
  wallet: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  signup_source: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
};

type TradeAttemptRow = {
  wallet: string | null;
  venue: string | null;
  mode: string | null;
  market: string | null;
  amount: string | null;
  status: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

type TradeRow = {
  wallet: string | null;
  token_amount: number | null;
  price_usd: number | null;
  executed_at: string | null;
};

type MarketViewRow = {
  wallet: string | null;
  venue: string | null;
  market: string | null;
  title: string | null;
  created_at: string | null;
};

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

type TractionUserRow = {
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

type AudienceSource = "waitlist" | "app" | "both";

type AudienceContactRow = {
  email: string;
  name: string | null;
  source: AudienceSource;
  wallets: string[];
  signupSource: string | null;
  country: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  accessCode: string | null;
  accessCodeUsedAt: string | null;
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

export type AdminTractionDashboard = {
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
  appUsers: TractionUserRow[];
  waitlistUsers: WaitlistUserRow[];
  audienceContacts: AudienceContactRow[];
};

type TelemetryTradeAttemptInput = {
  wallet?: string | null;
  venue?: string | null;
  mode?: string | null;
  market?: string | null;
  side?: string | null;
  inputAsset?: string | null;
  outputAsset?: string | null;
  amount?: string | null;
  status?: string | null;
  txSignature?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TelemetryMarketViewInput = {
  wallet?: string | null;
  venue?: string | null;
  market?: string | null;
  title?: string | null;
};

function normalizeWallet(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function cleanString(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getUserEmail(row: UserRow): string | null {
  return normalizeEmail(
    getMetadataString(row.metadata, ["email", "contact_email", "primary_email", "privy_email", "google_email", "github_email"]),
  );
}

function getUserName(row: UserRow): string | null {
  return cleanString(
    getMetadataString(row.metadata, ["display_name", "full_name", "name", "username", "handle"]),
  );
}

function normalizeVenue(value?: string | null): "kalshi" | "polymarket" | "other" {
  const lower = value?.trim().toLowerCase() ?? "";
  if (lower.includes("poly")) return "polymarket";
  if (lower.includes("kalshi")) return "kalshi";
  return "other";
}

function parseTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmount(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTradeVolumeUsd(row: TradeRow): number {
  const size = row.token_amount;
  const price = row.price_usd;
  if (typeof size !== "number" || !Number.isFinite(size)) return 0;
  if (typeof price !== "number" || !Number.isFinite(price)) return 0;
  return Math.abs(size * price);
}

function safeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybe = error as { code?: string; message?: string };
    return `${maybe.code ?? ""} ${maybe.message ?? ""}`.trim();
  }
  return "";
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const message = safeErrorMessage(error).toLowerCase();
  return message.includes("42p01") || (message.includes(tableName.toLowerCase()) && message.includes("does not exist"));
}

function isoDayFromMs(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildDailySeries(timestamps: Array<number | null>, days: number, nowMs: number, baseValue = 0) {
  const todayStartMs = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const startMs = todayStartMs - (days - 1) * DAY_MS;
  const series = Array.from({ length: days }, (_, index) => {
    const ts = startMs + index * DAY_MS;
    return { day: isoDayFromMs(ts), value: 0 };
  });
  const indexByDay = new Map(series.map((point, index) => [point.day, index]));

  for (const timestamp of timestamps) {
    if (timestamp == null || timestamp < startMs) continue;
    const day = isoDayFromMs(timestamp);
    const index = indexByDay.get(day);
    if (typeof index === "number") {
      series[index].value += 1;
    }
  }

  if (baseValue > 0) {
    let running = baseValue;
    return series.map((point) => {
      running += point.value;
      return { day: point.day, value: running };
    });
  }

  return series;
}

function toPercent(numerator: number, denominator: number): number {
  if (!(denominator > 0)) return 0;
  return (numerator / denominator) * 100;
}

function classifyAttemptStatus(status?: string | null): "attempted" | "success" | "failed" {
  const lower = status?.trim().toLowerCase() ?? "";
  if (lower === "success" || lower === "succeeded" || lower === "completed") return "success";
  if (lower === "failed" || lower === "failure" || lower === "error") return "failed";
  return "attempted";
}

function incrementMap(target: Map<string, number>, key: string, amount = 1) {
  target.set(key, (target.get(key) ?? 0) + amount);
}

function appendWalletTimestamp(target: Map<string, number[]>, wallet: string | null, timestamp: number | null) {
  if (!wallet || timestamp == null) return;
  const current = target.get(wallet) ?? [];
  current.push(timestamp);
  target.set(wallet, current);
}

function maxOf(...values: number[]) {
  return values.reduce((current, value) => (value > current ? value : current), 0);
}

async function fetchOptionalRows<T>(
  promise: PromiseLike<{ data: T[] | null; error: unknown }>,
  tableName: string,
): Promise<T[]> {
  const { data, error } = await promise;
  if (!error) return data ?? [];
  if (isMissingTableError(error, tableName)) return [];
  throw error;
}

function buildActivityWindows(nowMs: number) {
  const currentWeekStart = nowMs - 7 * DAY_MS;
  const previousWeekStart = nowMs - 14 * DAY_MS;
  const last24hStart = nowMs - DAY_MS;
  return { currentWeekStart, previousWeekStart, last24hStart };
}

export async function logTradeAttemptTelemetry(client: SupabaseClient, input: TelemetryTradeAttemptInput) {
  const payload = {
    wallet: normalizeWallet(input.wallet),
    venue: input.venue?.trim() || "unknown",
    mode: input.mode?.trim() || "unknown",
    market: input.market?.trim() || null,
    side: input.side?.trim() || null,
    input_asset: input.inputAsset?.trim() || null,
    output_asset: input.outputAsset?.trim() || null,
    amount: input.amount?.trim() || null,
    status: input.status?.trim() || "attempted",
    tx_signature: input.txSignature?.trim() || null,
    error_message: input.errorMessage?.trim() || null,
    metadata: input.metadata ?? {},
  };

  const { error } = await client.from("siren_trade_attempts").insert(payload);
  if (error) throw error;

  return payload;
}

export async function logMarketViewTelemetry(client: SupabaseClient, input: TelemetryMarketViewInput) {
  const payload = {
    wallet: normalizeWallet(input.wallet),
    venue: input.venue?.trim() || "unknown",
    market: input.market?.trim() || "unknown",
    title: input.title?.trim() || null,
  };

  const { error } = await client.from("siren_market_views").insert(payload);
  if (error) throw error;
}

export async function buildAdminTractionDashboard(client: SupabaseClient): Promise<AdminTractionDashboard> {
  const nowMs = Date.now();
  const { currentWeekStart, previousWeekStart, last24hStart } = buildActivityWindows(nowMs);
  const todayStartMs = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastHourStartMs = nowMs - 60 * 60 * 1000;

  const [waitlistRows, userRows, attemptRows, tradeRows, marketViewRows] = await Promise.all([
    fetchOptionalRows<WaitlistRow>(
      client
        .from("waitlist_signups")
        .select("id,created_at,access_code,access_code_used_at,email,wallet,name")
        .order("created_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "waitlist_signups",
    ),
    fetchOptionalRows<UserRow>(
      client
        .from("users")
        .select("id,wallet,created_at,last_seen_at,signup_source,country,metadata")
        .order("created_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "users",
    ),
    fetchOptionalRows<TradeAttemptRow>(
      client
        .from("siren_trade_attempts")
        .select("wallet,venue,mode,market,amount,status,created_at,metadata")
        .order("created_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "siren_trade_attempts",
    ),
    fetchOptionalRows<TradeRow>(
      client
        .from("siren_trades")
        .select("wallet,token_amount,price_usd,executed_at")
        .order("executed_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "siren_trades",
    ),
    fetchOptionalRows<MarketViewRow>(
      client
        .from("siren_market_views")
        .select("wallet,venue,market,title,created_at")
        .order("created_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "siren_market_views",
    ),
  ]);

  const waitlistConverted = waitlistRows.filter((row) => !!row.access_code_used_at).length;
  const waitlistPending = Math.max(waitlistRows.length - waitlistConverted, 0);

  const userCreatedTimestamps = userRows.map((row) => parseTimestamp(row.created_at));
  const signupWindowStartMs = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`) - 29 * DAY_MS;
  const usersBeforeWindow = userCreatedTimestamps.filter((timestamp) => timestamp != null && timestamp < signupWindowStartMs).length;
  const dailySignups = buildDailySeries(userCreatedTimestamps, 30, nowMs);
  const cumulativeUsers = buildDailySeries(userCreatedTimestamps, 30, nowMs, usersBeforeWindow);

  const activeUsers24h = userRows.filter((row) => {
    const lastSeen = parseTimestamp(row.last_seen_at);
    return lastSeen != null && lastSeen >= last24hStart;
  }).length;
  const activeUsers7d = userRows.filter((row) => {
    const lastSeen = parseTimestamp(row.last_seen_at);
    return lastSeen != null && lastSeen >= currentWeekStart;
  }).length;

  const attemptStartsByWallet = new Map<string, number>();
  const attemptSuccessByWallet = new Map<string, number>();
  const attemptFailedByWallet = new Map<string, number>();
  const activityTsByWallet = new Map<string, number[]>();
  const attemptMarketCounts = new Map<string, { market: string; venue: string; count: number }>();
  const sizeCounts = new Map<string, TopSize>();
  const venueAttempts = { kalshi: 0, polymarket: 0 };
  const venueOutcomeCounts = { kalshi: 0, polymarket: 0 };
  let attemptedToday = 0;
  let succeededToday = 0;
  let failedToday = 0;
  let attemptStartCount24h = 0;
  let attemptOutcomeCount24h = 0;

  for (const row of attemptRows) {
    const ts = parseTimestamp(row.created_at);
    const wallet = normalizeWallet(row.wallet);
    const status = classifyAttemptStatus(row.status);
    const venue = normalizeVenue(row.venue);
    appendWalletTimestamp(activityTsByWallet, wallet, ts);

    if (status === "attempted") {
      if (wallet) incrementMap(attemptStartsByWallet, wallet);
      if (venue === "kalshi") venueAttempts.kalshi += 1;
      if (venue === "polymarket") venueAttempts.polymarket += 1;
      if (ts != null && ts >= todayStartMs) attemptedToday += 1;
      if (ts != null && ts >= last24hStart) attemptStartCount24h += 1;

      const topMarketKey = `${venue}:${row.market?.trim() || "unknown"}`;
      const current = attemptMarketCounts.get(topMarketKey) ?? {
        market: row.market?.trim() || "Unknown market",
        venue,
        count: 0,
      };
      current.count += 1;
      attemptMarketCounts.set(topMarketKey, current);

      const parsedAmount = parseAmount(row.amount);
      const isBuyMode = (row.mode?.toLowerCase() ?? "").includes("buy");
      if (parsedAmount != null && parsedAmount > 0 && isBuyMode) {
        const rounded = parsedAmount >= 10 ? Math.round(parsedAmount) : Number(parsedAmount.toFixed(2));
        const sizeKey = rounded.toString();
        const existing = sizeCounts.get(sizeKey) ?? {
          amount: rounded,
          label: rounded >= 1 ? `$${rounded.toLocaleString()}` : `$${rounded.toFixed(2)}`,
          count: 0,
        };
        existing.count += 1;
        sizeCounts.set(sizeKey, existing);
      }
    }

    if (status === "success") {
      if (wallet) {
        incrementMap(attemptSuccessByWallet, wallet);
      }
      if (venue === "kalshi") venueOutcomeCounts.kalshi += 1;
      if (venue === "polymarket") venueOutcomeCounts.polymarket += 1;
      if (ts != null && ts >= todayStartMs) succeededToday += 1;
      if (ts != null && ts >= last24hStart) attemptOutcomeCount24h += 1;
    }

    if (status === "failed") {
      if (wallet) {
        incrementMap(attemptFailedByWallet, wallet);
      }
      if (venue === "kalshi") venueOutcomeCounts.kalshi += 1;
      if (venue === "polymarket") venueOutcomeCounts.polymarket += 1;
      if (ts != null && ts >= todayStartMs) failedToday += 1;
      if (ts != null && ts >= last24hStart) attemptOutcomeCount24h += 1;
    }
  }

  const tradesByWallet = new Map<string, number>();
  const tradeVolumeByWallet = new Map<string, number>();
  let platformVolumeUsd = 0;

  for (const row of tradeRows) {
    const wallet = normalizeWallet(row.wallet);
    const ts = parseTimestamp(row.executed_at);
    const volumeUsd = getTradeVolumeUsd(row);
    platformVolumeUsd += volumeUsd;
    appendWalletTimestamp(activityTsByWallet, wallet, ts);
    if (!wallet) continue;
    incrementMap(tradesByWallet, wallet);
    tradeVolumeByWallet.set(wallet, (tradeVolumeByWallet.get(wallet) ?? 0) + volumeUsd);
  }

  const marketViewsByKey = new Map<string, { market: string; venue: string; count: number }>();
  const activityCurrentWeek = new Set<string>();
  const activityPreviousWeek = new Set<string>();

  for (const row of marketViewRows) {
    const ts = parseTimestamp(row.created_at);
    const wallet = normalizeWallet(row.wallet);
    const venue = normalizeVenue(row.venue);
    const market = row.title?.trim() || row.market?.trim() || "Unknown market";
    const key = `${venue}:${market}`;
    const current = marketViewsByKey.get(key) ?? { market, venue, count: 0 };
    current.count += 1;
    marketViewsByKey.set(key, current);
    appendWalletTimestamp(activityTsByWallet, wallet, ts);

    if (wallet && ts != null) {
      if (ts >= currentWeekStart) activityCurrentWeek.add(wallet);
      if (ts >= previousWeekStart && ts < currentWeekStart) activityPreviousWeek.add(wallet);
    }
  }

  for (const row of attemptRows) {
    const ts = parseTimestamp(row.created_at);
    const wallet = normalizeWallet(row.wallet);
    if (!wallet || ts == null) continue;
    if (ts >= currentWeekStart) activityCurrentWeek.add(wallet);
    if (ts >= previousWeekStart && ts < currentWeekStart) activityPreviousWeek.add(wallet);
  }

  for (const row of tradeRows) {
    const ts = parseTimestamp(row.executed_at);
    const wallet = normalizeWallet(row.wallet);
    if (!wallet || ts == null) continue;
    if (ts >= currentWeekStart) activityCurrentWeek.add(wallet);
    if (ts >= previousWeekStart && ts < currentWeekStart) activityPreviousWeek.add(wallet);
  }

  const appUsersForTable: TractionUserRow[] = userRows.map((row) => {
    const wallet = normalizeWallet(row.wallet);
    const attemptCount = wallet
      ? maxOf(
          attemptStartsByWallet.get(wallet) ?? 0,
          (attemptSuccessByWallet.get(wallet) ?? 0) + (attemptFailedByWallet.get(wallet) ?? 0),
          tradesByWallet.get(wallet) ?? 0,
        )
      : 0;
    const successCount = wallet ? maxOf(attemptSuccessByWallet.get(wallet) ?? 0, tradesByWallet.get(wallet) ?? 0) : 0;
    const volumeUsd = wallet ? tradeVolumeByWallet.get(wallet) ?? 0 : 0;
    return {
      id: row.id,
      wallet: row.wallet,
      email: getUserEmail(row),
      name: getUserName(row),
      signupDate: row.created_at,
      lastActive: row.last_seen_at,
      signupSource: cleanString(row.signup_source),
      country: cleanString(row.country),
      tradesAttempted: attemptCount,
      tradesSucceeded: successCount,
      volumeUsd,
    };
  });

  const waitlistUsersForTable: WaitlistUserRow[] = [...waitlistRows]
    .sort((left, right) => (parseTimestamp(right.created_at) ?? 0) - (parseTimestamp(left.created_at) ?? 0))
    .map((row) => ({
      id: row.id,
      email: normalizeEmail(row.email),
      name: cleanString(row.name),
      wallet: row.wallet,
      signupDate: row.created_at,
      accessCode: cleanString(row.access_code),
      accessCodeIssued: Boolean(cleanString(row.access_code)),
      accessCodeUsedAt: row.access_code_used_at,
      converted: Boolean(row.access_code_used_at),
    }));

  const audienceContactMap = new Map<
    string,
    {
      email: string;
      name: string | null;
      seenWaitlist: boolean;
      seenApp: boolean;
      wallets: Set<string>;
      signupSource: string | null;
      country: string | null;
      createdAt: string | null;
      lastSeenAt: string | null;
      accessCode: string | null;
      accessCodeUsedAt: string | null;
    }
  >();

  const mergeAudienceContact = (input: {
    email: string | null;
    name?: string | null;
    source: "waitlist" | "app";
    wallet?: string | null;
    signupSource?: string | null;
    country?: string | null;
    createdAt?: string | null;
    lastSeenAt?: string | null;
    accessCode?: string | null;
    accessCodeUsedAt?: string | null;
  }) => {
    if (!input.email) return;
    const existing = audienceContactMap.get(input.email) ?? {
      email: input.email,
      name: null,
      seenWaitlist: false,
      seenApp: false,
      wallets: new Set<string>(),
      signupSource: null,
      country: null,
      createdAt: null,
      lastSeenAt: null,
      accessCode: null,
      accessCodeUsedAt: null,
    };

    if (!existing.name && input.name) existing.name = input.name;
    if (input.source === "waitlist") existing.seenWaitlist = true;
    if (input.source === "app") existing.seenApp = true;

    const wallet = normalizeWallet(input.wallet);
    if (wallet) existing.wallets.add(wallet);
    if (!existing.signupSource && input.signupSource) existing.signupSource = input.signupSource;
    if (!existing.country && input.country) existing.country = input.country;
    if (!existing.accessCode && input.accessCode) existing.accessCode = input.accessCode;
    if (!existing.accessCodeUsedAt && input.accessCodeUsedAt) existing.accessCodeUsedAt = input.accessCodeUsedAt;

    const createdAtTs = parseTimestamp(input.createdAt ?? null);
    const existingCreatedAtTs = parseTimestamp(existing.createdAt);
    if (createdAtTs != null && (existingCreatedAtTs == null || createdAtTs < existingCreatedAtTs)) {
      existing.createdAt = input.createdAt ?? null;
    }

    const lastSeenTs = parseTimestamp(input.lastSeenAt ?? null);
    const existingLastSeenTs = parseTimestamp(existing.lastSeenAt);
    if (lastSeenTs != null && (existingLastSeenTs == null || lastSeenTs > existingLastSeenTs)) {
      existing.lastSeenAt = input.lastSeenAt ?? null;
    }

    audienceContactMap.set(input.email, existing);
  };

  for (const row of waitlistRows) {
    mergeAudienceContact({
      email: normalizeEmail(row.email),
      name: cleanString(row.name),
      source: "waitlist",
      wallet: row.wallet,
      createdAt: row.created_at,
      accessCode: cleanString(row.access_code),
      accessCodeUsedAt: row.access_code_used_at,
    });
  }

  for (const row of userRows) {
    mergeAudienceContact({
      email: getUserEmail(row),
      name: getUserName(row),
      source: "app",
      wallet: row.wallet,
      signupSource: cleanString(row.signup_source),
      country: cleanString(row.country),
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    });
  }

  const audienceContacts: AudienceContactRow[] = Array.from(audienceContactMap.values())
    .map((row) => {
      const source: AudienceSource = row.seenWaitlist && row.seenApp ? "both" : row.seenApp ? "app" : "waitlist";
      return {
        email: row.email,
        name: row.name,
        source,
        wallets: Array.from(row.wallets).sort(),
        signupSource: row.signupSource,
        country: row.country,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        accessCode: row.accessCode,
        accessCodeUsedAt: row.accessCodeUsedAt,
      };
    })
    .sort((left, right) => {
      const rightTs = parseTimestamp(right.lastSeenAt) ?? parseTimestamp(right.createdAt) ?? 0;
      const leftTs = parseTimestamp(left.lastSeenAt) ?? parseTimestamp(left.createdAt) ?? 0;
      return rightTs - leftTs;
    });

  const waitlistOnlyContacts = audienceContacts.filter((row) => row.source === "waitlist").length;
  const appOnlyContacts = audienceContacts.filter((row) => row.source === "app").length;
  const bothSourceContacts = audienceContacts.filter((row) => row.source === "both").length;
  const waitlistWithEmail = waitlistRows.filter((row) => !!normalizeEmail(row.email)).length;
  const waitlistMissingCodes = waitlistRows.filter((row) => !!normalizeEmail(row.email) && !cleanString(row.access_code)).length;
  const waitlistIssuedCodes = waitlistRows.filter((row) => !!normalizeEmail(row.email) && !!cleanString(row.access_code)).length;
  const waitlistRedeemedCodes = waitlistRows.filter((row) => !!normalizeEmail(row.email) && !!row.access_code_used_at).length;
  const appUsersWithEmail = userRows.filter((row) => !!getUserEmail(row)).length;
  const activeAppContacts7d = audienceContacts.filter((row) => row.source !== "waitlist" && (parseTimestamp(row.lastSeenAt) ?? 0) >= currentWeekStart).length;
  const dormantAppContacts14d = audienceContacts.filter((row) => {
    if (row.source === "waitlist") return false;
    const lastSeenTs = parseTimestamp(row.lastSeenAt);
    if (lastSeenTs != null) return lastSeenTs < nowMs - 14 * DAY_MS;
    const createdAtTs = parseTimestamp(row.createdAt);
    return createdAtTs != null && createdAtTs < nowMs - 14 * DAY_MS;
  }).length;

  const attemptedAtLeastOneTrade = appUsersForTable.filter((row) => row.tradesAttempted >= 1).length;
  const attemptedThreePlusTrades = appUsersForTable.filter((row) => row.tradesAttempted >= 3).length;
  const openedTerminalNeverTraded = appUsersForTable.filter((row) => row.tradesAttempted === 0).length;
  const signupToFirstTradeDropoffRate = toPercent(openedTerminalNeverTraded, appUsersForTable.length);

  const totalTradesSuccessful = appUsersForTable.reduce((sum, row) => sum + row.tradesSucceeded, 0);
  const totalTradesFailed = Array.from(attemptFailedByWallet.values()).reduce((sum, count) => sum + count, 0);
  const totalTradesAttempted = maxOf(
    Array.from(attemptStartsByWallet.values()).reduce((sum, count) => sum + count, 0),
    totalTradesSuccessful + totalTradesFailed,
  );
  const effectiveAttemptedToday = Math.max(attemptedToday, succeededToday + failedToday);
  const effectiveAttemptCount24h = Math.max(attemptStartCount24h, attemptOutcomeCount24h);
  const effectiveVenueBreakdown = {
    kalshi: Math.max(venueAttempts.kalshi, venueOutcomeCounts.kalshi),
    polymarket: Math.max(venueAttempts.polymarket, venueOutcomeCounts.polymarket),
  };

  const topBrowsedMarketsFromViews = Array.from(marketViewsByKey.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const topBrowsedMarketsFallback = Array.from(attemptMarketCounts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const useMarketViews = topBrowsedMarketsFromViews.length > 0;

  const topAttemptedSizes = Array.from(sizeCounts.values())
    .sort((left, right) => right.count - left.count || right.amount - left.amount)
    .slice(0, 5);

  let day1Eligible = 0;
  let day1Retained = 0;
  let day7Eligible = 0;
  let day7Retained = 0;
  let retentionEstimatedFromLastSeen = false;

  for (const user of userRows) {
    const signupTs = parseTimestamp(user.created_at);
    if (signupTs == null) continue;
    const wallet = normalizeWallet(user.wallet);
    const lastSeenTs = parseTimestamp(user.last_seen_at);
    const activityTs = wallet ? activityTsByWallet.get(wallet) ?? [] : [];
    const activityAfterDay1 = activityTs.some((ts) => ts >= signupTs + DAY_MS);
    const activityAfterDay7 = activityTs.some((ts) => ts >= signupTs + 7 * DAY_MS);
    const inferredDay1 = lastSeenTs != null && lastSeenTs >= signupTs + DAY_MS;
    const inferredDay7 = lastSeenTs != null && lastSeenTs >= signupTs + 7 * DAY_MS;

    if (nowMs >= signupTs + DAY_MS) {
      day1Eligible += 1;
      if (activityAfterDay1 || inferredDay1) {
        day1Retained += 1;
        if (!activityAfterDay1 && inferredDay1) retentionEstimatedFromLastSeen = true;
      }
    }

    if (nowMs >= signupTs + 7 * DAY_MS) {
      day7Eligible += 1;
      if (activityAfterDay7 || inferredDay7) {
        day7Retained += 1;
        if (!activityAfterDay7 && inferredDay7) retentionEstimatedFromLastSeen = true;
      }
    }
  }

  const weeklyReturningUsers = Array.from(activityCurrentWeek).filter((wallet) => activityPreviousWeek.has(wallet)).length;

  const successTimestampsByWallet = new Map<string, number>();
  for (const row of attemptRows) {
    const wallet = normalizeWallet(row.wallet);
    const ts = parseTimestamp(row.created_at);
    if (!wallet || ts == null || classifyAttemptStatus(row.status) !== "success") continue;
    const current = successTimestampsByWallet.get(wallet);
    if (current == null || ts < current) {
      successTimestampsByWallet.set(wallet, ts);
    }
  }
  for (const row of tradeRows) {
    const wallet = normalizeWallet(row.wallet);
    const ts = parseTimestamp(row.executed_at);
    if (!wallet || ts == null) continue;
    const current = successTimestampsByWallet.get(wallet);
    if (current == null || ts < current) {
      successTimestampsByWallet.set(wallet, ts);
    }
  }

  const recent24hSignups = userCreatedTimestamps.filter((ts) => ts != null && ts >= last24hStart).length;
  const previous24hSignups = userCreatedTimestamps.filter((ts) => ts != null && ts >= nowMs - 2 * DAY_MS && ts < last24hStart).length;
  const firstTradeInLastHour = Array.from(successTimestampsByWallet.values()).some((ts) => ts >= lastHourStartMs);
  const emailConfigured = canSendEmail();

  const campaignPresets: CampaignPreset[] = buildEmailCampaignPresets({
    waitlistWithEmail,
    waitlistMissingCodes,
    reachableContacts: audienceContacts.length,
    attemptedAtLeastOneTrade,
    attemptedThreePlusTrades,
  });

  const campaignGapSummary =
    appOnlyContacts > 0
      ? `${appOnlyContacts} app-only contacts are now included in code-defined merged-audience campaigns from this panel.`
      : "Campaign buttons are generated from the backend campaign registry, so adding a new coded campaign will surface here automatically.";

  const alerts: DashboardAlert[] = [
    {
      tone: "red",
      label: "No trades",
      active: effectiveAttemptCount24h === 0,
      detail: effectiveAttemptCount24h === 0 ? "No trade attempts landed in the last 24 hours." : "Trade activity exists in the last 24 hours.",
    },
    {
      tone: "yellow",
      label: "Signups down",
      active: previous24hSignups > 0 && recent24hSignups < previous24hSignups,
      detail:
        previous24hSignups > 0 && recent24hSignups < previous24hSignups
          ? `Last 24h signups (${recent24hSignups}) are below the previous 24h (${previous24hSignups}).`
          : "Signup pace is steady or improving against the previous 24 hours.",
    },
    {
      tone: "green",
      label: "First trade",
      active: firstTradeInLastHour,
      detail: firstTradeInLastHour ? "A user completed their first trade in the last hour." : "No new first-trade user in the last hour.",
    },
  ];

  return {
    generatedAt: new Date(nowMs).toISOString(),
    alerts,
    header: {
      totalRegisteredUsers: userRows.length,
      activeUsers7d,
      activeUsers24h,
      totalTradesAttempted,
      totalTradesSuccessful,
      platformVolumeUsd,
    },
    allTime: {
      waitlistUsers: waitlistRows.length,
      appUsers: userRows.length,
      reachableContacts: audienceContacts.length,
      convertedWaitlistUsers: waitlistConverted,
      totalMarketViews: marketViewRows.length,
      totalTradeFailures: totalTradesFailed,
    },
    growth: {
      dailySignups,
      cumulativeUsers,
      waitlistUsers: waitlistRows.length,
      convertedUsers: waitlistConverted,
      waitlistPending,
    },
    engagement: {
      openedTerminalNeverTraded,
      attemptedAtLeastOneTrade,
      attemptedThreePlusTrades,
      signupToFirstTradeDropoffRate,
    },
    tradeActivity: {
      attemptedToday: effectiveAttemptedToday,
      succeededToday,
      failedToday,
      topBrowsedMarkets: useMarketViews ? topBrowsedMarketsFromViews : topBrowsedMarketsFallback,
      topAttemptedSizes,
      browsedMarketsSource: useMarketViews ? "market_views" : "trade_attempts_fallback",
    },
    venueBreakdown: {
      kalshiAttempts: effectiveVenueBreakdown.kalshi,
      polymarketAttempts: effectiveVenueBreakdown.polymarket,
      leader:
        effectiveVenueBreakdown.kalshi === 0 && effectiveVenueBreakdown.polymarket === 0
          ? "none"
          : effectiveVenueBreakdown.kalshi === effectiveVenueBreakdown.polymarket
            ? "tie"
            : effectiveVenueBreakdown.kalshi > effectiveVenueBreakdown.polymarket
              ? "kalshi"
              : "polymarket",
    },
    retention: {
      day1Retention: toPercent(day1Retained, day1Eligible),
      day7Retention: toPercent(day7Retained, day7Eligible),
      activeThisWeekAlsoLastWeek: weeklyReturningUsers,
      estimatedFromLastSeen: retentionEstimatedFromLastSeen,
    },
    audience: {
      emailConfigured,
      reachableContacts: audienceContacts.length,
      waitlistOnlyContacts,
      appOnlyContacts,
      bothSourceContacts,
      waitlistWithEmail,
      waitlistMissingCodes,
      waitlistIssuedCodes,
      waitlistRedeemedCodes,
      appUsersWithEmail,
      activeAppContacts7d,
      dormantAppContacts14d,
    },
    campaigns: {
      presets: campaignPresets,
      gapSummary: campaignGapSummary,
    },
    appUsers: appUsersForTable,
    waitlistUsers: waitlistUsersForTable,
    audienceContacts,
  };
}
