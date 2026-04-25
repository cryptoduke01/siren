import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_ROWS = 10_000;

type WaitlistRow = {
  created_at: string | null;
  access_code_used_at: string | null;
  email: string | null;
  wallet: string | null;
};

type UserRow = {
  id: string;
  wallet: string | null;
  created_at: string | null;
  last_seen_at: string | null;
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
  signupDate: string | null;
  lastActive: string | null;
  tradesAttempted: number;
  tradesSucceeded: number;
  volumeUsd: number;
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
  users: TractionUserRow[];
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
        .select("created_at,access_code_used_at,email,wallet")
        .order("created_at", { ascending: true })
        .limit(MAX_ANALYTICS_ROWS),
      "waitlist_signups",
    ),
    fetchOptionalRows<UserRow>(
      client
        .from("users")
        .select("id,wallet,created_at,last_seen_at")
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

  const userRowsForTable: TractionUserRow[] = userRows.map((row) => {
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
      signupDate: row.created_at,
      lastActive: row.last_seen_at,
      tradesAttempted: attemptCount,
      tradesSucceeded: successCount,
      volumeUsd,
    };
  });

  const attemptedAtLeastOneTrade = userRowsForTable.filter((row) => row.tradesAttempted >= 1).length;
  const attemptedThreePlusTrades = userRowsForTable.filter((row) => row.tradesAttempted >= 3).length;
  const openedTerminalNeverTraded = userRowsForTable.filter((row) => row.tradesAttempted === 0).length;
  const signupToFirstTradeDropoffRate = toPercent(openedTerminalNeverTraded, userRowsForTable.length);

  const totalTradesSuccessful = userRowsForTable.reduce((sum, row) => sum + row.tradesSucceeded, 0);
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
    users: userRowsForTable,
  };
}
