/**
 * Same shape as UnifiedBuyPanel `siren-trades-${wallet}` entries — on-device activity feed.
 */

export interface LocalTradeLedgerRow {
  ts: number;
  mint: string;
  side: "buy" | "sell";
  solAmount: number;
  tokenAmount: number;
  priceUsd: number;
  /** USDC / USD notional for prediction buys when trade is not a SOL swap. */
  stakeUsd?: number;
  tokenName?: string;
  tokenSymbol?: string;
  txSignature?: string;
  amountUsd?: number;
  fromSymbol?: string;
  toSymbol?: string;
  counterparty?: string;
  note?: string;
  activityKind?: "prediction" | "swap" | "token" | "send" | "receive" | "close";
}

const MAX_ROWS = 500;

type Lot = {
  qty: number;
  px: number;
};

export interface LocalPositionStat {
  mint: string;
  openQty: number;
  avgEntryUsd: number | null;
  avgEntryCents: number | null;
  realizedPnlUsd: number;
  realizedSellCount: number;
}

function keyForWallet(wallet: string): string {
  return `siren-trades-${wallet}`;
}

export function readLocalTrades(wallet: string): LocalTradeLedgerRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyForWallet(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LocalTradeLedgerRow =>
        r &&
        typeof r === "object" &&
        typeof (r as LocalTradeLedgerRow).ts === "number" &&
        typeof (r as LocalTradeLedgerRow).mint === "string" &&
        typeof (r as LocalTradeLedgerRow).side === "string",
    ) as LocalTradeLedgerRow[];
  } catch {
    return [];
  }
}

export function pushLocalTrade(wallet: string, row: LocalTradeLedgerRow): void {
  if (typeof window === "undefined") return;
  const prev = readLocalTrades(wallet);
  prev.push(row);
  const next = prev.length > MAX_ROWS ? prev.slice(prev.length - MAX_ROWS) : prev;
  window.localStorage.setItem(keyForWallet(wallet), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("siren-activity-logged"));
}

export function buildLocalPositionStatsMap(wallet: string): Map<string, LocalPositionStat> {
  const rows = readLocalTrades(wallet)
    .filter((row) => {
      return (
        row.activityKind !== "send" &&
        row.activityKind !== "receive" &&
        typeof row.mint === "string" &&
        row.mint.trim().length > 0 &&
        (row.side === "buy" || row.side === "sell") &&
        Number.isFinite(row.tokenAmount) &&
        Number.isFinite(row.priceUsd) &&
        row.tokenAmount > 0 &&
        row.priceUsd > 0
      );
    })
    .sort((a, b) => a.ts - b.ts);

  const lotsByMint = new Map<string, Lot[]>();
  const realizedByMint = new Map<string, { pnlUsd: number; sellCount: number }>();

  for (const row of rows) {
    const mint = row.mint.trim();
    const qty = row.tokenAmount;
    const px = row.priceUsd;
    const lots = lotsByMint.get(mint) ?? [];
    if (!lotsByMint.has(mint)) lotsByMint.set(mint, lots);

    if (row.side === "buy") {
      lots.push({ qty, px });
      continue;
    }

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

  const out = new Map<string, LocalPositionStat>();

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
