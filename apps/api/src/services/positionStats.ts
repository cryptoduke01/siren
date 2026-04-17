import type { SupabaseClient } from "@supabase/supabase-js";

type SirenTradeRow = {
  wallet: string;
  mint: string;
  side: string;
  token_amount: number | null;
  price_usd: number | null;
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
  realizedSellCount: number;
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
  const normalizedWallet = wallet.trim();
  const out = new Map<string, WalletPositionStat>();
  if (!normalizedWallet) return out;

  const { data, error } = await client
    .from("siren_trades")
    .select("wallet,mint,side,token_amount,price_usd,executed_at")
    .eq("wallet", normalizedWallet)
    .order("executed_at", { ascending: true });

  if (error) {
    if (isMissingTradeTable(error)) return out;
    throw new Error(error.message || "Unable to load position stats");
  }

  const rows = ((data ?? []) as SirenTradeRow[]).filter((row) => {
    return (
      typeof row.mint === "string" &&
      row.mint.trim().length > 0 &&
      typeof row.side === "string" &&
      row.token_amount != null &&
      row.price_usd != null &&
      Number.isFinite(row.token_amount) &&
      Number.isFinite(row.price_usd) &&
      row.token_amount > 0 &&
      row.price_usd > 0
    );
  });

  const lotsByMint = new Map<string, Lot[]>();
  const realizedByMint = new Map<string, { pnlUsd: number; sellCount: number }>();

  for (const row of rows) {
    const mint = row.mint.trim();
    const side = row.side.toLowerCase();
    const qty = row.token_amount as number;
    const px = row.price_usd as number;
    const lots = lotsByMint.get(mint) ?? [];
    if (!lotsByMint.has(mint)) lotsByMint.set(mint, lots);

    if (side === "buy") {
      lots.push({ qty, px });
      continue;
    }

    if (side !== "sell") continue;

    let sellLeft = qty;
    let sellPnl = 0;
    let matched = false;
    while (sellLeft > 1e-12 && lots.length > 0) {
      const front = lots[0];
      const take = Math.min(sellLeft, front.qty);
      matched = true;
      sellPnl += (px - front.px) * take;
      front.qty -= take;
      sellLeft -= take;
      if (front.qty <= 1e-12) lots.shift();
    }
    if (matched) {
      const realized = realizedByMint.get(mint) ?? { pnlUsd: 0, sellCount: 0 };
      realized.pnlUsd += sellPnl;
      realized.sellCount += 1;
      realizedByMint.set(mint, realized);
    }
  }

  for (const [mint, lots] of lotsByMint.entries()) {
    const openQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
    const costUsd = lots.reduce((sum, lot) => sum + lot.qty * lot.px, 0);
    const avgEntryUsd = openQty > 1e-12 ? costUsd / openQty : null;
    const avgEntryCents = avgEntryUsd != null ? avgEntryUsd * 100 : null;
    const realized = realizedByMint.get(mint) ?? { pnlUsd: 0, sellCount: 0 };
    out.set(mint, {
      mint,
      openQty,
      avgEntryUsd,
      avgEntryCents,
      realizedPnlUsd: Number(realized.pnlUsd.toFixed(6)),
      realizedSellCount: realized.sellCount,
    });
  }

  for (const [mint, realized] of realizedByMint.entries()) {
    if (out.has(mint)) continue;
    out.set(mint, {
      mint,
      openQty: 0,
      avgEntryUsd: null,
      avgEntryCents: null,
      realizedPnlUsd: Number(realized.pnlUsd.toFixed(6)),
      realizedSellCount: realized.sellCount,
    });
  }

  return out;
}
