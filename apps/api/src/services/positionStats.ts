import type { SupabaseClient } from "@supabase/supabase-js";

type SirenTradeRow = {
  wallet: string;
  mint: string;
  side: string;
  token_amount: number | null;
  price_usd: number | null;
  token_name: string | null;
  token_symbol: string | null;
  executed_at: string;
};

type Lot = {
  qty: number;
  px: number;
};

export type WalletPositionStat = {
  mint: string;
  openQty: number;
  avgEntryUsd: number | null;
  avgEntryCents: number | null;
  realizedPnlUsd: number;
  realizedPnlPct: number | null;
  realizedSellCount: number;
};

export type WalletPositionHistory = WalletPositionStat & {
  boughtQty: number;
  soldQty: number;
  matchedCostUsd: number;
  firstBoughtAt: string | null;
  lastBoughtAt: string | null;
  lastSoldAt: string | null;
  lastExecutedAt: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
};

function isMissingTradeTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = (err.code || "").toLowerCase();
  return code === "42p01" || msg.includes("siren_trades") || msg.includes("does not exist") || msg.includes("schema cache");
}

export async function getWalletPositionStats(
  client: SupabaseClient,
  wallet: string,
): Promise<Map<string, WalletPositionStat>> {
  const history = await getWalletPositionHistory(client, wallet);
  const out = new Map<string, WalletPositionStat>();
  for (const row of history) {
    out.set(row.mint, {
      mint: row.mint,
      openQty: row.openQty,
      avgEntryUsd: row.avgEntryUsd,
      avgEntryCents: row.avgEntryCents,
      realizedPnlUsd: row.realizedPnlUsd,
      realizedPnlPct: row.realizedPnlPct,
      realizedSellCount: row.realizedSellCount,
    });
  }
  return out;
}

export async function getWalletPositionHistory(
  client: SupabaseClient,
  wallet: string,
): Promise<WalletPositionHistory[]> {
  const normalizedWallet = wallet.trim();
  const out = new Map<string, WalletPositionHistory>();
  if (!normalizedWallet) return [];

  const { data, error } = await client
    .from("siren_trades")
    .select("wallet,mint,side,token_amount,price_usd,token_name,token_symbol,executed_at")
    .eq("wallet", normalizedWallet)
    .order("executed_at", { ascending: true });

  if (error) {
    if (isMissingTradeTable(error)) return [];
    throw new Error(error.message || "Unable to load position stats");
  }

  const rows = (data ?? []) as SirenTradeRow[];

  const lotsByMint = new Map<string, Lot[]>();
  const realizedByMint = new Map<string, { pnlUsd: number; costUsd: number; sellCount: number }>();

  for (const row of rows) {
    if (typeof row.mint !== "string" || row.mint.trim().length === 0 || typeof row.side !== "string") {
      continue;
    }

    const mint = row.mint.trim();
    const side = row.side.toLowerCase();
    const qty = row.token_amount ?? 0;
    const px = row.price_usd ?? 0;
    const tokenName = typeof row.token_name === "string" && row.token_name.trim() ? row.token_name.trim() : null;
    const tokenSymbol = typeof row.token_symbol === "string" && row.token_symbol.trim() ? row.token_symbol.trim() : null;
    const executedAt = typeof row.executed_at === "string" && row.executed_at.trim() ? row.executed_at : null;

    const history = out.get(mint) ?? {
      mint,
      openQty: 0,
      avgEntryUsd: null,
      avgEntryCents: null,
      realizedPnlUsd: 0,
      realizedPnlPct: null,
      realizedSellCount: 0,
      boughtQty: 0,
      soldQty: 0,
      matchedCostUsd: 0,
      firstBoughtAt: null,
      lastBoughtAt: null,
      lastSoldAt: null,
      lastExecutedAt: null,
      tokenName: null,
      tokenSymbol: null,
    };
    if (tokenName) history.tokenName = tokenName;
    if (tokenSymbol) history.tokenSymbol = tokenSymbol;
    if (executedAt) history.lastExecutedAt = executedAt;
    out.set(mint, history);

    if (!(Number.isFinite(qty) && Number.isFinite(px) && qty > 0 && px > 0)) {
      continue;
    }

    const lots = lotsByMint.get(mint) ?? [];
    if (!lotsByMint.has(mint)) lotsByMint.set(mint, lots);

    if (side === "buy") {
      history.boughtQty += qty;
      history.firstBoughtAt = history.firstBoughtAt ?? executedAt;
      history.lastBoughtAt = executedAt ?? history.lastBoughtAt;
      lots.push({ qty, px });
      continue;
    }

    if (side !== "sell") continue;

    history.soldQty += qty;
    history.lastSoldAt = executedAt ?? history.lastSoldAt;
    let sellLeft = qty;
    let sellPnl = 0;
    let matchedCostUsd = 0;
    let matched = false;
    while (sellLeft > 1e-12 && lots.length > 0) {
      const front = lots[0];
      const take = Math.min(sellLeft, front.qty);
      matched = true;
      sellPnl += (px - front.px) * take;
      matchedCostUsd += front.px * take;
      front.qty -= take;
      sellLeft -= take;
      if (front.qty <= 1e-12) lots.shift();
    }
    if (matched) {
      const realized = realizedByMint.get(mint) ?? { pnlUsd: 0, costUsd: 0, sellCount: 0 };
      realized.pnlUsd += sellPnl;
      realized.costUsd += matchedCostUsd;
      realized.sellCount += 1;
      realizedByMint.set(mint, realized);
    }
  }

  for (const [mint, lots] of lotsByMint.entries()) {
    const openQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
    const costUsd = lots.reduce((sum, lot) => sum + lot.qty * lot.px, 0);
    const avgEntryUsd = openQty > 1e-12 ? costUsd / openQty : null;
    const avgEntryCents = avgEntryUsd != null ? avgEntryUsd * 100 : null;
    const realized = realizedByMint.get(mint) ?? { pnlUsd: 0, costUsd: 0, sellCount: 0 };
    const row = out.get(mint);
    if (!row) continue;
    row.openQty = openQty;
    row.avgEntryUsd = avgEntryUsd;
    row.avgEntryCents = avgEntryCents;
    row.matchedCostUsd = Number(realized.costUsd.toFixed(6));
    row.realizedPnlUsd = Number(realized.pnlUsd.toFixed(6));
    row.realizedPnlPct = realized.costUsd > 0 ? Number(((realized.pnlUsd / realized.costUsd) * 100).toFixed(4)) : null;
    row.realizedSellCount = realized.sellCount;
  }

  for (const [mint, realized] of realizedByMint.entries()) {
    const row = out.get(mint);
    if (!row) continue;
    row.matchedCostUsd = Number(realized.costUsd.toFixed(6));
    row.realizedPnlUsd = Number(realized.pnlUsd.toFixed(6));
    row.realizedPnlPct = realized.costUsd > 0 ? Number(((realized.pnlUsd / realized.costUsd) * 100).toFixed(4)) : null;
    row.realizedSellCount = realized.sellCount;
  }

  return [...out.values()].sort((left, right) => {
    const leftTs = left.lastExecutedAt ? Date.parse(left.lastExecutedAt) : 0;
    const rightTs = right.lastExecutedAt ? Date.parse(right.lastExecutedAt) : 0;
    return rightTs - leftTs;
  });
}
