const STORAGE_KEY = "siren-position-entry-v1";

export interface PositionEntryRow {
  /** Average price paid per share, in cents (same units as Kalshi YES/NO price). */
  avgCents: number;
  updatedAt: number;
}

function readMap(): Record<string, PositionEntryRow> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, PositionEntryRow>;
  } catch {
    return {};
  }
}

export function getPositionEntry(mint: string): PositionEntryRow | null {
  const row = readMap()[mint];
  if (!row || typeof row.avgCents !== "number" || !Number.isFinite(row.avgCents)) return null;
  return row;
}

export function setPositionEntry(mint: string, avgCents: number): void {
  const map = readMap();
  map[mint] = { avgCents, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Mark in cents for PnL: YES uses YES prob %; NO uses implied NO cents (100 - yes%). */
export function markCentsForSide(side: string, probabilityRaw: number | undefined): number {
  const p = probabilityRaw ?? 0;
  const probPct = p > 1 ? p : p * 100;
  const clamped = Math.min(100, Math.max(0, probPct));
  return side.toLowerCase() === "no" ? 100 - clamped : clamped;
}

export function pnlFromAvgEntry(params: {
  side: string;
  probability?: number;
  shares: number;
  avgCents: number;
}): { pnlUsd: number; pnlPct: number } {
  const { side, probability, shares, avgCents } = params;
  const mark = markCentsForSide(side, probability);
  const pnlUsd = shares * (mark - avgCents) / 100;
  const costUsd = shares * (avgCents / 100);
  const pnlPct = costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0;
  return { pnlUsd, pnlPct };
}
