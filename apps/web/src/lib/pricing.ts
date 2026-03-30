export const SOL_PRICE_QUERY_KEY = ["sol-price"] as const;
export const ETH_PRICE_QUERY_KEY = ["eth-price"] as const;

export function parseFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function fetchSolPriceUsd(apiUrl: string): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/sol-price`, { credentials: "omit" });
    if (!res.ok) return 0;

    const payload = await res.json();
    return Math.max(0, parseFiniteNumber(payload?.usd) ?? 0);
  } catch {
    return 0;
  }
}

export async function fetchEthPriceUsd(apiUrl: string): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/eth-price`, { credentials: "omit" });
    if (!res.ok) return 0;

    const payload = await res.json();
    return Math.max(0, parseFiniteNumber(payload?.usd) ?? 0);
  } catch {
    return 0;
  }
}

export function formatUsd(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}
