/**
 * Builds leaderboards from `siren_trades` (Supabase). Volume = sum(token_amount * price_usd).
 * Win rate (traders only): FIFO cost basis per wallet+mint; each sell matched to prior buys → win if realized PnL > 0.
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
  /** Traders only; null when no decisive sells. */
  winRate: number | null;
  wins: number;
  losses: number;
  avatarUrl?: string | null;
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

function aggregateByMint(trades: SirenTradeRow[]): Map<string, { volumeUsd: number; tradeCount: number; label: string }> {
  const m = new Map<string, { volumeUsd: number; tradeCount: number; label: string }>();
  for (const t of trades) {
    const mint = (t.mint || "").trim();
    if (!mint) continue;
    const vol = notional(t);
    const cur = m.get(mint) ?? { volumeUsd: 0, tradeCount: 0, label: t.token_symbol?.trim() || mint.slice(0, 8) + "…" };
    cur.volumeUsd += vol;
    cur.tradeCount += 1;
    if (t.token_symbol?.trim()) cur.label = t.token_symbol.trim();
    m.set(mint, cur);
  }
  return m;
}

/** Kalshi-style tickers often start with KX and contain hyphens. */
function isLikelyMarketTicker(symbol: string | null | undefined): boolean {
  const s = (symbol || "").trim();
  if (!s) return false;
  if (s.startsWith("KX")) return true;
  if (/^[A-Z0-9]{2,}-[A-Z0-9]/.test(s)) return true;
  return false;
}

function aggregateByMarketSymbol(trades: SirenTradeRow[]): Map<string, { volumeUsd: number; tradeCount: number; label: string }> {
  const m = new Map<string, { volumeUsd: number; tradeCount: number; label: string }>();
  for (const t of trades) {
    const sym = (t.token_symbol || "").trim();
    if (!isLikelyMarketTicker(sym)) continue;
    const vol = notional(t);
    const cur = m.get(sym) ?? { volumeUsd: 0, tradeCount: 0, label: sym };
    cur.volumeUsd += vol;
    cur.tradeCount += 1;
    if (t.token_name?.trim()) cur.label = t.token_name.trim();
    m.set(sym, cur);
  }
  return m;
}

function sortAndRank(
  entries: Array<{
    id: string;
    label: string;
    subtitle?: string;
    volumeUsd: number;
    tradeCount: number;
    wins: number;
    losses: number;
    winRate: number | null;
  }>,
  metric: "volume" | "winRate",
  limit: number,
): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
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
    winRate: e.winRate,
    wins: e.wins,
    losses: e.losses,
  }));
}

export async function buildLeaderboard(params: {
  client: SupabaseClient;
  scope: "users" | "tokens" | "markets";
  window: "7d" | "30d" | "all";
  metric: "volume" | "winRate";
  limit?: number;
}): Promise<{
  window: string;
  scope: string;
  metric: string;
  entries: LeaderboardRow[];
  emptyReason?: string;
  truncated?: boolean;
}> {
  const { client, scope, window, metric, limit = 50 } = params;
  const sinceIso = windowStartIso(window);

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
      emptyReason: "No trades in this period yet. Trade from the terminal and they will show up here.",
    };
  }

  if (scope === "users") {
    const stats = processTraderStats(trades);
    const entries = [...stats.entries()].map(([wallet, s]) => {
      const decided = s.wins + s.losses;
      const winRate = decided > 0 ? (s.wins / decided) * 100 : null;
      return {
        id: wallet,
        label: wallet.slice(0, 4) + "…" + wallet.slice(-4),
        subtitle: `${s.tradeCount} trades`,
        volumeUsd: s.volumeUsd,
        tradeCount: s.tradeCount,
        wins: s.wins,
        losses: s.losses,
        winRate,
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

  if (scope === "tokens") {
    const agg = aggregateByMint(trades);
    const entries = [...agg.entries()].map(([mint, s]) => ({
      id: mint,
      label: s.label,
      subtitle: mint.slice(0, 6) + "…" + mint.slice(-4),
      volumeUsd: s.volumeUsd,
      tradeCount: s.tradeCount,
      wins: 0,
      losses: 0,
      winRate: null as number | null,
    }));
    return {
      window,
      scope,
      metric: "volume",
      entries: sortAndRank(entries, "volume", limit),
      ...(truncated ? { truncated: true } : {}),
    };
  }

  // markets
  const agg = aggregateByMarketSymbol(trades);
  const entries = [...agg.entries()].map(([sym, s]) => ({
    id: sym,
    label: s.label.length > 48 ? s.label.slice(0, 45) + "…" : s.label,
    subtitle: sym,
    volumeUsd: s.volumeUsd,
    tradeCount: s.tradeCount,
    wins: 0,
    losses: 0,
    winRate: null as number | null,
  }));

  if (entries.length === 0) {
    return {
      window,
      scope,
      metric: "volume",
      entries: [],
      emptyReason: "No prediction-market style trades (KX tickers) in this window. Meme token volume is under Tokens.",
    };
  }

  return {
    window,
    scope,
    metric: "volume",
    entries: sortAndRank(entries, "volume", limit),
    ...(truncated ? { truncated: true } : {}),
  };
}

export async function enrichUsersWithProfiles(
  client: SupabaseClient,
  entries: LeaderboardRow[],
): Promise<LeaderboardRow[]> {
  const wallets = [...new Set(entries.map((e) => walletKey(e.id)))];
  if (wallets.length === 0) return entries;

  const { data, error } = await client.from("users").select("wallet,username,avatar_url").in("wallet", wallets);
  if (error || !data?.length) return entries;

  const map = new Map<string, { username: string | null; avatar_url: string | null }>();
  for (const row of data as { wallet: string; username: string | null; avatar_url: string | null }[]) {
    map.set(walletKey(row.wallet), { username: row.username, avatar_url: row.avatar_url });
  }

  return entries.map((e) => {
    const prof = map.get(walletKey(e.id));
    if (!prof) return e;
    const next = { ...e, avatarUrl: prof.avatar_url ?? null };
    if (prof.username) {
      next.label = prof.username.startsWith("@") ? prof.username : `@${prof.username}`;
    }
    return next;
  });
}
