/**
 * Builds trader leaderboards from `siren_trades` (Supabase), **prediction markets only**
 * (Kalshi-style tickers, Polymarket rows, etc.). Generic SPL swaps are excluded.
 * Volume = sum(token_amount * price_usd).
 * Win rate: FIFO cost basis per wallet+mint; each sell matched to prior buys → win if realized PnL > 0.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** `users.wallet` is stored lowercase; trade rows may be canonical base58. */
function walletKey(wallet: string): string {
  return wallet.trim().toLowerCase();
}

export interface SirenTradeRow {
  wallet: string;
  mint: string;
  side: string;
  token_amount: number | null;
  price_usd: number | null;
  token_symbol: string | null;
  token_name: string | null;
  executed_at: string;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  label: string;
  subtitle?: string;
  volumeUsd: number;
  tradeCount: number;
  attemptCount?: number;
  /** Traders only; null when no decisive sells. */
  winRate: number | null;
  successRate?: number | null;
  executionScore?: number | null;
  wins: number;
  losses: number;
  avatarUrl?: string | null;
}

export interface TradeAttemptRow {
  wallet: string | null;
  mode: string | null;
  status: string;
  created_at: string;
}

function notional(t: SirenTradeRow): number {
  const a = t.token_amount;
  const p = t.price_usd;
  if (a == null || p == null || !Number.isFinite(a) || !Number.isFinite(p) || a <= 0 || p <= 0) return 0;
  return a * p;
}

function windowStartIso(window: "7d" | "30d" | "all"): string | null {
  if (window === "all") return null;
  const days = window === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const MAX_TRADE_ROWS = 25_000;
const PAGE = 1000;

function isSirenTradesMissingError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = (err.code || "").toLowerCase();
  return (
    code === "42p01" ||
    msg.includes("siren_trades") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}

function isTradeAttemptsMissingError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = (err.code || "").toLowerCase();
  return code === "42p01" || msg.includes("siren_trade_attempts") || msg.includes("does not exist");
}

async function fetchTradesInWindow(
  client: SupabaseClient,
  sinceIso: string | null,
): Promise<{ rows: SirenTradeRow[]; truncated: boolean; missingTable?: boolean }> {
  const out: SirenTradeRow[] = [];
  let from = 0;
  /** Bounded windows: oldest-first (full window fits in cap). All-time: newest-first pages, then reverse for FIFO. */
  const ascending = sinceIso != null;

  while (out.length < MAX_TRADE_ROWS) {
    let q = client
      .from("siren_trades")
      .select("wallet,mint,side,token_amount,price_usd,token_symbol,token_name,executed_at")
      .order("executed_at", { ascending });
    if (sinceIso) {
      q = q.gte("executed_at", sinceIso);
    }
    const { data, error } = await q.range(from, from + PAGE - 1);

    if (error) {
      if (isSirenTradesMissingError(error)) {
        return { rows: [], truncated: false, missingTable: true };
      }
      throw new Error(error.message || "siren_trades query failed");
    }
    const rows = (data ?? []) as SirenTradeRow[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  if (!ascending) {
    out.reverse();
  }

  return { rows: out, truncated: out.length >= MAX_TRADE_ROWS };
}

async function fetchTradeAttemptsInWindow(
  client: SupabaseClient,
  sinceIso: string | null,
): Promise<{ rows: TradeAttemptRow[]; missingTable?: boolean }> {
  const out: TradeAttemptRow[] = [];
  let from = 0;

  while (out.length < MAX_TRADE_ROWS) {
    let q = client
      .from("siren_trade_attempts")
      .select("wallet,mode,status,created_at")
      .order("created_at", { ascending: true });
    if (sinceIso) q = q.gte("created_at", sinceIso);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) {
      if (isTradeAttemptsMissingError(error)) {
        return { rows: [], missingTable: true };
      }
      throw new Error(error.message || "siren_trade_attempts query failed");
    }
    const rows = (data ?? []) as TradeAttemptRow[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return { rows: out };
}

type Lot = { qty: number; px: number };

function processTraderStats(trades: SirenTradeRow[]): Map<
  string,
  { volumeUsd: number; tradeCount: number; wins: number; losses: number }
> {
  const byWallet = new Map<
    string,
    { volumeUsd: number; tradeCount: number; wins: number; losses: number }
  >();
  const lots = new Map<string, Lot[]>();

  const bump = (wallet: string, vol: number) => {
    const cur = byWallet.get(wallet) ?? { volumeUsd: 0, tradeCount: 0, wins: 0, losses: 0 };
    cur.volumeUsd += vol;
    cur.tradeCount += 1;
    byWallet.set(wallet, cur);
  };

  for (const t of trades) {
    const w = (t.wallet || "").trim();
    const mint = (t.mint || "").trim();
    if (!w || !mint) continue;

    const vol = notional(t);
    bump(w, vol);

    const amt = t.token_amount;
    const px = t.price_usd;
    if (amt == null || px == null || !Number.isFinite(amt) || !Number.isFinite(px) || amt <= 0 || px <= 0) {
      continue;
    }

    const side = (t.side || "").toLowerCase();
    const key = `${w}::${mint}`;
    if (!lots.has(key)) lots.set(key, []);
    const q = lots.get(key)!;
    const st = byWallet.get(w)!;

    if (side === "buy") {
      q.push({ qty: amt, px });
    } else if (side === "sell") {
      let sellLeft = amt;
      let sellPnl = 0;
      let matchedAny = false;
      while (sellLeft > 1e-12 && q.length > 0) {
        const front = q[0];
        const take = Math.min(sellLeft, front.qty);
        matchedAny = true;
        sellPnl += (px - front.px) * take;
        front.qty -= take;
        sellLeft -= take;
        if (front.qty <= 1e-12) q.shift();
      }
      if (matchedAny && Math.abs(sellPnl) > 1e-8) {
        if (sellPnl > 0) st.wins += 1;
        else st.losses += 1;
      }
    }
  }

  return byWallet;
}

/** Kalshi-style tickers often start with KX and contain hyphens. */
function isLikelyMarketTicker(symbol: string | null | undefined): boolean {
  const s = (symbol || "").trim();
  if (!s) return false;
  if (s.startsWith("KX")) return true;
  if (/^[A-Z0-9]{2,}-[A-Z0-9]/.test(s)) return true;
  return false;
}

/** Logged trades that count as prediction-market activity (not generic SPL swaps). */
export function isPredictionMarketTrade(t: SirenTradeRow): boolean {
  const sym = (t.token_symbol || "").trim();
  if (isLikelyMarketTicker(sym)) return true;
  if (/^POLY-/i.test(sym)) return true;
  if (/\b(YES|NO)\s+POLY-/i.test(sym)) return true;
  const name = (t.token_name || "").trim();
  if (name.includes("·") && /\b(YES|NO)\b/i.test(name)) return true;
  return false;
}

function sortAndRank(
  entries: Array<{
    id: string;
    label: string;
    subtitle?: string;
    volumeUsd: number;
    tradeCount: number;
    attemptCount?: number;
    wins: number;
    losses: number;
    winRate: number | null;
    successRate?: number | null;
    executionScore?: number | null;
  }>,
  metric: "volume" | "winRate" | "execution",
  limit: number,
): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (metric === "execution") {
      const ae = a.executionScore ?? -1;
      const be = b.executionScore ?? -1;
      if (be !== ae) return be - ae;
      const as = a.successRate ?? -1;
      const bs = b.successRate ?? -1;
      if (bs !== as) return bs - as;
      return b.volumeUsd - a.volumeUsd;
    }
    if (metric === "winRate") {
      const ar = a.winRate ?? -1;
      const br = b.winRate ?? -1;
      if (br !== ar) return br - ar;
      return b.volumeUsd - a.volumeUsd;
    }
    return b.volumeUsd - a.volumeUsd;
  });

  return sorted.slice(0, limit).map((e, i) => ({
    rank: i + 1,
    id: e.id,
    label: e.label,
    subtitle: e.subtitle,
    volumeUsd: e.volumeUsd,
    tradeCount: e.tradeCount,
    attemptCount: e.attemptCount,
    winRate: e.winRate,
    successRate: e.successRate,
    executionScore: e.executionScore,
    wins: e.wins,
    losses: e.losses,
  }));
}

function processExecutionStats(attempts: TradeAttemptRow[]): Map<
  string,
  { attemptCount: number; successCount: number; partialCount: number; closeAttempts: number; closeSuccess: number }
> {
  const byWallet = new Map<
    string,
    { attemptCount: number; successCount: number; partialCount: number; closeAttempts: number; closeSuccess: number }
  >();

  for (const row of attempts) {
    const wallet = (row.wallet || "").trim();
    if (!wallet) continue;
    const current =
      byWallet.get(wallet) ?? { attemptCount: 0, successCount: 0, partialCount: 0, closeAttempts: 0, closeSuccess: 0 };
    current.attemptCount += 1;
    if (row.status === "success") current.successCount += 1;
    if (row.status === "partial") current.partialCount += 1;
    if ((row.mode || "").toLowerCase() === "sell") {
      current.closeAttempts += 1;
      if (row.status === "success" || row.status === "partial") current.closeSuccess += 1;
    }
    byWallet.set(wallet, current);
  }

  return byWallet;
}

export async function buildLeaderboard(params: {
  client: SupabaseClient;
  window: "7d" | "30d" | "all";
  metric: "volume" | "winRate" | "execution";
  limit?: number;
}): Promise<{
  window: string;
  scope: "prediction_traders";
  metric: string;
  entries: LeaderboardRow[];
  emptyReason?: string;
  truncated?: boolean;
}> {
  const { client, window, metric, limit = 50 } = params;
  const sinceIso = windowStartIso(window);
  const scope = "prediction_traders" as const;

  let trades: SirenTradeRow[];
  let truncated = false;
  try {
    const fetched = await fetchTradesInWindow(client, sinceIso);
    if (fetched.missingTable) {
      return {
        window,
        scope,
        metric,
        entries: [],
        emptyReason:
          "Rankings will go live once trade history is connected. Meanwhile, check Activity on Portfolio for this device.",
      };
    }
    trades = fetched.rows;
    truncated = fetched.truncated;
  } catch (e) {
    const msg = (e as Error).message || "";
    if (/siren_trades|schema cache|does not exist/i.test(msg)) {
      return {
        window,
        scope,
        metric,
        entries: [],
        emptyReason:
          "Rankings will go live once trade history is connected. Meanwhile, check Activity on Portfolio for this device.",
      };
    }
    return {
      window,
      scope,
      metric,
      entries: [],
      emptyReason: "Could not load rankings right now. Try again in a moment.",
    };
  }

  if (trades.length === 0) {
    return {
      window,
      scope,
      metric,
      entries: [],
      emptyReason: "No trades in this period yet. Trade prediction markets from the terminal to appear here.",
    };
  }

  const predictionTrades = trades.filter(isPredictionMarketTrade);
  let executionStats = new Map<
    string,
    { attemptCount: number; successCount: number; partialCount: number; closeAttempts: number; closeSuccess: number }
  >();
  try {
    const fetchedAttempts = await fetchTradeAttemptsInWindow(client, sinceIso);
    if (!fetchedAttempts.missingTable) {
      executionStats = processExecutionStats(fetchedAttempts.rows);
    }
  } catch {
    // Keep leaderboard working even if attempt telemetry is unavailable.
  }

  if (predictionTrades.length === 0) {
    return {
      window,
      scope,
      metric,
      entries: [],
      emptyReason:
        "No prediction market volume in this window yet. Trade Kalshi or Polymarket events from Siren — generic token swaps are not ranked here.",
    };
  }

  const stats = processTraderStats(predictionTrades);
  const entries = [...stats.entries()].map(([wallet, s]) => {
    const decided = s.wins + s.losses;
    const winRate = decided > 0 ? (s.wins / decided) * 100 : null;
    const attempts = executionStats.get(wallet) ?? executionStats.get(walletKey(wallet));
    const attemptCount = attempts?.attemptCount ?? 0;
    const successRate =
      attemptCount > 0 ? (((attempts?.successCount ?? 0) + (attempts?.partialCount ?? 0) * 0.5) / attemptCount) * 100 : null;
    const closeRate =
      (attempts?.closeAttempts ?? 0) > 0 ? ((attempts?.closeSuccess ?? 0) / (attempts?.closeAttempts ?? 1)) * 100 : null;
    const executionScore =
      successRate == null
        ? null
        : Number(
            Math.min(
              100,
              successRate * 0.7 +
                (closeRate ?? successRate) * 0.2 +
                Math.min(10, Math.log10(Math.max(1, attemptCount)) * 5),
            ).toFixed(1),
          );
    return {
      id: wallet,
      label: wallet.slice(0, 4) + "…" + wallet.slice(-4),
      subtitle: executionScore != null ? `${executionScore.toFixed(0)} execution score` : `${s.tradeCount} trades`,
      volumeUsd: s.volumeUsd,
      tradeCount: s.tradeCount,
      attemptCount,
      wins: s.wins,
      losses: s.losses,
      winRate,
      successRate,
      executionScore,
    };
  });
  return {
    window,
    scope,
    metric,
    entries: sortAndRank(entries, metric, limit),
    ...(truncated ? { truncated: true } : {}),
  };
}

export async function enrichUsersWithProfiles(
  client: SupabaseClient,
  entries: LeaderboardRow[],
): Promise<LeaderboardRow[]> {
  const wallets = [...new Set(entries.map((e) => walletKey(e.id)))];
  if (wallets.length === 0) return entries;

  const { data, error } = await client.from("users").select("wallet,username,display_name,avatar_url").in("wallet", wallets);
  if (error || !data?.length) return entries;

  const map = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
  for (const row of data as { wallet: string; username: string | null; display_name: string | null; avatar_url: string | null }[]) {
    map.set(walletKey(row.wallet), {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }

  return entries.map((e) => {
    const prof = map.get(walletKey(e.id));
    if (!prof) return e;
    const next = { ...e, avatarUrl: prof.avatar_url ?? null };
    if (prof.display_name?.trim()) {
      next.label = prof.display_name.trim();
      if (prof.username?.trim()) {
        next.subtitle = prof.username.startsWith("@") ? prof.username : `@${prof.username}`;
      }
    } else if (prof.username?.trim()) {
      next.label = prof.username.startsWith("@") ? prof.username : `@${prof.username}`;
    }
    return next;
  });
}
