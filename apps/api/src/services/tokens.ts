import type { SurfacedToken, LaunchpadId } from "@siren/shared";
import { getKeywordsForCategory } from "@siren/shared";
import { matchTokenToKeywords } from "@siren/shared";
import { searchPairs, getTokenPairs, getLatestBoostedTokens } from "./dexscreener.js";
import type { DexPair } from "./dexscreener.js";
import { getBagsPools } from "./bags.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Detect launchpad from mint suffix (Bags: BAGS, Pump.fun: pump, Bonk.fun: bonk, Moonshot: shot). */
export function getLaunchpadFromMint(mint: string): LaunchpadId | undefined {
  const lower = mint.toLowerCase();
  if (lower.endsWith("bags")) return "bags";
  if (lower.endsWith("pump")) return "pump";
  if (lower.endsWith("bonk")) return "bonk";
  if (lower.endsWith("shot") || lower.endsWith("moonshot")) return "moonshot";
  return undefined;
}

function tokenMintFromPair(p: DexPair): string {
  const base = p.baseToken.address;
  const quote = p.quoteToken.address;
  if (base === SOL_MINT) return quote;
  if (quote === SOL_MINT) return base;
  return base;
}

function pairsToSurfacedTokens(pairs: DexPair[], keywords: string[]): SurfacedToken[] {
  const byMint = new Map<string, DexPair>();
  for (const p of pairs) {
    const mint = tokenMintFromPair(p);
    const existing = byMint.get(mint);
    const vol = p.volume?.h24 ?? 0;
    const existingVol = existing?.volume?.h24 ?? 0;
    if (!existing || vol > existingVol) byMint.set(mint, p);
  }

  return Array.from(byMint.entries()).map(([mint, p]) => {
    const token = (p.baseToken.address === mint ? p.baseToken : p.quoteToken) as { address: string; symbol: string; name: string };
    const name = token.name || token.symbol || "Unknown";
    const symbol = token.symbol || "???";
    const priceUsd = p.priceUsd ? parseFloat(p.priceUsd) : undefined;
    const vol24h = p.volume?.h24;
    const nameMatch = keywords.length ? matchTokenToKeywords(name, symbol, keywords) : true;
    const volumeWeight = vol24h ? Math.min(vol24h / 100_000, 1) * 0.5 : 0;
    const relevanceScore = (nameMatch ? 0.5 : 0) + volumeWeight;

    return {
      mint,
      name,
      symbol,
      price: priceUsd,
      volume24h: vol24h ? Math.round(vol24h) : undefined,
      imageUrl: p.info?.imageUrl?.startsWith("http")
        ? p.info.imageUrl
        : p.info?.imageUrl
          ? `https://cdn.dexscreener.com/cms/images/${p.info.imageUrl}?width=800&height=800&quality=90`
          : undefined,
      relevanceScore,
      matchType: nameMatch ? "name" : "volume",
      launchpad: getLaunchpadFromMint(mint),
    };
  });
}

const STOP_WORDS = new Set(["will", "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "any", "did", "let", "put", "say", "she", "too", "use", "from", "than", "that", "this", "with", "what", "when", "where", "which"]);

function parseKeywordsParam(param?: string): string[] {
  if (!param?.trim()) return [];
  return param.split(/[\s,]+/).filter((k) => k.length >= 2).slice(0, 5);
}

/** Extract meaningful keywords from a market title for token search. */
export function extractKeywordsFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  const words = lower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out.slice(0, 4);
}

export async function getSurfacedTokens(marketId?: string, categoryId?: string, keywordsParam?: string): Promise<SurfacedToken[]> {
  const hasExplicitKeywords = parseKeywordsParam(keywordsParam).length > 0 || !!categoryId;
  const keywords =
    parseKeywordsParam(keywordsParam).length > 0 ? parseKeywordsParam(keywordsParam)
    : categoryId ? getKeywordsForCategory(categoryId)
    : [];

  const allPairs: DexPair[] = [];
  const seenMints = new Set<string>();

  if (!hasExplicitKeywords) {
    if (process.env.BAGS_API_KEY) {
      try {
        const pools = await getBagsPools();
        const bagsMints = pools.map((p) => p.tokenMint).filter((m) => m.endsWith("BAGS")).slice(0, 24);
        for (let i = 0; i < bagsMints.length; i += 4) {
          const batch = bagsMints.slice(i, i + 4);
          const results = await Promise.all(batch.map((m) => getTokenPairs(m)));
          for (let j = 0; j < batch.length; j++) {
            const pairs = results[j];
            const queriedMint = batch[j];
            if (pairs.length > 0 && !seenMints.has(queriedMint)) {
              const best = pairs.reduce((a, b) => ((a.volume?.h24 ?? 0) > (b.volume?.h24 ?? 0) ? a : b));
              seenMints.add(queriedMint);
              allPairs.push(best);
            }
          }
        }
      } catch (e) {
        console.warn("[tokens] Bags pools fetch failed:", e);
      }
    }
    try {
      const boosted = await getLatestBoostedTokens();
      const boostedMints = boosted.slice(0, 16).map((t) => t.tokenAddress).filter((m) => !seenMints.has(m));
      for (let i = 0; i < boostedMints.length; i += 4) {
        const batch = boostedMints.slice(i, i + 4);
        const results = await Promise.all(batch.map((m) => getTokenPairs(m)));
        for (let j = 0; j < batch.length; j++) {
          const pairs = results[j];
          const queriedMint = batch[j];
          if (pairs.length > 0 && !seenMints.has(queriedMint)) {
            const best = pairs.reduce((a, b) => ((a.volume?.h24 ?? 0) > (b.volume?.h24 ?? 0) ? a : b));
            seenMints.add(queriedMint);
            allPairs.push(best);
          }
        }
      }
      const surfaced = pairsToSurfacedTokens(allPairs, []);
      if (surfaced.length > 0) {
        return surfaced
          .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
          .slice(0, 24);
      }
    } catch (e) {
      console.warn("[tokens] DexScreener boosted failed:", e);
    }
  }

  if (keywords.length > 0) {
    try {
      const searchTerms = keywords.slice(0, 5);
      const keywordPairs: DexPair[] = [];
      for (const term of searchTerms) {
        const pairs = await searchPairs(term);
        keywordPairs.push(...pairs);
      }
      const surfaced = pairsToSurfacedTokens(keywordPairs, keywords);
      if (surfaced.length > 0) {
        return surfaced
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 24);
      }
    } catch (e) {
      console.warn("[tokens] DexScreener search failed:", e);
    }
  }

  const surfaced = pairsToSurfacedTokens(allPairs, keywords);
  return surfaced
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, 24);
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd?: number;
  volume24h?: number;
}

const JUPITER_TOKEN_LIST_URL = "https://tokens.jup.ag/tokens?tags=verified";
let jupiterTokenCache: Map<string, { name: string; symbol: string; logoURI?: string }> | null = null;
let jupiterCacheTime = 0;
const JUPITER_CACHE_MS = 60 * 60 * 1000;

async function getJupiterTokenByMint(mint: string): Promise<{ name: string; symbol: string; imageUrl?: string } | null> {
  try {
    if (!jupiterTokenCache || Date.now() - jupiterCacheTime > JUPITER_CACHE_MS) {
      const res = await fetch(JUPITER_TOKEN_LIST_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const list = (await res.json()) as Array<{ address: string; symbol?: string; name?: string; logoURI?: string }>;
      jupiterTokenCache = new Map();
      for (const t of list) {
        if (t.address && (t.symbol || t.name)) {
          jupiterTokenCache.set(t.address, {
            name: t.name ?? t.symbol ?? "Unknown",
            symbol: t.symbol ?? "???",
            logoURI: t.logoURI,
          });
        }
      }
      jupiterCacheTime = Date.now();
    }
    const t = jupiterTokenCache.get(mint);
    if (!t) return null;
    return { name: t.name, symbol: t.symbol, imageUrl: t.logoURI };
  } catch {
    return null;
  }
}

/** Get token metadata and price by mint (DexScreener first, Jupiter strict list fallback). */
export async function getTokenInfoByMint(mint: string): Promise<TokenInfo | null> {
  try {
    const pairs = await getTokenPairs(mint);
    if (pairs.length > 0) {
      const best = pairs.reduce((a, b) => ((a.volume?.h24 ?? 0) > (b.volume?.h24 ?? 0) ? a : b));
      const base = best.baseToken.address === mint ? best.baseToken : best.quoteToken;
      const priceUsd = best.priceUsd ? parseFloat(best.priceUsd) : undefined;
      const imageUrl = best.info?.imageUrl?.startsWith("http")
        ? best.info.imageUrl
        : best.info?.imageUrl
          ? `https://cdn.dexscreener.com/cms/images/${best.info.imageUrl}?width=800&height=800&quality=90`
          : undefined;
      return {
        mint,
        name: base.name || base.symbol || "Unknown",
        symbol: base.symbol || "???",
        imageUrl,
        priceUsd,
        volume24h: best.volume?.h24 ? Math.round(best.volume.h24) : undefined,
      };
    }
    const jup = await getJupiterTokenByMint(mint);
    if (jup) {
      return { mint, name: jup.name, symbol: jup.symbol, imageUrl: jup.imageUrl, priceUsd: undefined };
    }
    return null;
  } catch {
    return null;
  }
}
