/**
 * DexScreener API — token discovery (no API key required).
 * Base URL: https://api.dexscreener.com
 * Docs: https://docs.dexscreener.com/api/reference
 * Rate limits: ~60/min for token profiles, ~300/min for pair queries.
 */

const BASE_URL = process.env.DEXSCREENER_BASE_URL || "https://api.dexscreener.com";

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
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
  icon?: string;
}

interface BoostedResponse {
  data?: BoostedToken[];
}

/** Search pairs by token symbol, name, or address. Returns Solana pairs only. */
export async function searchPairs(query: string): Promise<DexPair[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const url = `${BASE_URL}/latest/dex/search?q=${q}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`DexScreener search error: ${res.status}`);
  const json = (await res.json()) as SearchResponse;
  const pairs = json.pairs ?? [];
  return pairs.filter((p) => p.chainId === "solana");
}

/** Get top boosted tokens (trending). Rate limit 60/min. */
export async function getTopBoostedTokens(): Promise<BoostedToken[]> {
  const url = `${BASE_URL}/token-boosts/top/v1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`DexScreener boosted error: ${res.status}`);
  const json = (await res.json()) as BoostedResponse;
  return (json.data ?? []).filter((t) => t.chainId === "solana");
}
