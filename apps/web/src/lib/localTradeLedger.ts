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
}

const MAX_ROWS = 500;

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
        typeof (r as LocalTradeLedgerRow).mint === "string",
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
}
