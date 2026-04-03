/**
 * DexScreener API — token discovery (no API key required).
 * Base URL: https://api.dexscreener.com
 * Docs: https://docs.dexscreener.com/api/reference
 * Rate limits: ~60/min for token profiles, ~300/min for pair queries.
 */

const BASE_URL = process.env.DEXSCREENER_BASE_URL || "https://api.dexscreener.com";
const DEXSCREENER_TIMEOUT_MS = 6_000;

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number; h6?: number; h1?: number };
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
}

interface SearchResponse {
  schemaVersion?: string;
  pairs?: DexPair[];
}

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  symbol?: string;
  name?: string;
  description?: string;
  icon?: string;
  url?: string;
}

interface BoostedResponse {
  data?: BoostedToken[];
}

async function fetchDexScreener<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(DEXSCREENER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`);
  return (await res.json()) as T;
}

/** Search pairs by token symbol, name, or address. Returns Solana pairs only. */
export async function searchPairs(query: string): Promise<DexPair[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const url = `${BASE_URL}/latest/dex/search?q=${q}`;
  const json = await fetchDexScreener<SearchResponse>(url);
  const pairs = json.pairs ?? [];
  return pairs.filter((p) => p.chainId === "solana");
}

/** Get top boosted tokens (trending). Rate limit 60/min. */
export async function getTopBoostedTokens(): Promise<BoostedToken[]> {
  const url = `${BASE_URL}/token-boosts/top/v1`;
  const json = await fetchDexScreener<BoostedResponse>(url);
  return (json.data ?? []).filter((t) => t.chainId === "solana");
}

/** Get latest boosted tokens (new uprising). Returns raw array. Rate limit 60/min. */
export async function getLatestBoostedTokens(): Promise<BoostedToken[]> {
  const url = `${BASE_URL}/token-boosts/latest/v1`;
  const json = await fetchDexScreener<BoostedToken[] | BoostedResponse>(url);
  const arr = Array.isArray(json) ? json : (json as BoostedResponse).data ?? [];
  return arr.filter((t) => t.chainId === "solana");
}

/** Get pairs for a token address. Returns Solana pairs with price/volume. */
export async function getTokenPairs(tokenAddress: string): Promise<DexPair[]> {
  const url = `${BASE_URL}/token-pairs/v1/solana/${encodeURIComponent(tokenAddress)}`;
  try {
    const json = await fetchDexScreener<{ schemaVersion?: string; pairs?: DexPair[] }>(url);
    return (json.pairs ?? []).filter((p) => p.chainId === "solana");
  } catch {
    return [];
  }
}
