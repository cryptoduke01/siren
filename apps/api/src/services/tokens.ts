import type { SurfacedToken } from "@siren/shared";
import { getKeywordsForCategory } from "@siren/shared";
import { matchTokenToKeywords } from "@siren/shared";
import { searchPairs, getLatestBoostedTokens, getTokenPairs } from "./dexscreener.js";
import type { DexPair } from "./dexscreener.js";

/** Fallback: Curated demo tokens when DexScreener fails or returns empty. */
const MOCK_TOKENS: Array<{
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  volume24h?: number;
  ctMentions?: number;
  categoryIds: string[];
}> = [
  { mint: "So11111111111111111111111111111111111111112", name: "JPOW", symbol: "JPOW", volume24h: 150, price: 0.00042, ctMentions: 420, categoryIds: ["fed-rates", "cpi-inflation"] },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "Printer", symbol: "BRRR", volume24h: 89, price: 0.00031, ctMentions: 210, categoryIds: ["fed-rates"] },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", name: "Inflation Hedge", symbol: "CPI", volume24h: 45, price: 0.00018, ctMentions: 120, categoryIds: ["cpi-inflation"] },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", name: "TrumpCoin", symbol: "TRUMP", volume24h: 500, price: 0.0012, ctMentions: 1200, categoryIds: ["elections"] },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", name: "SEC Crusher", symbol: "GENS", volume24h: 78, price: 0.00058, ctMentions: 95, categoryIds: ["crypto-regulation"] },
];

function pairsToSurfacedTokens(pairs: DexPair[], keywords: string[]): SurfacedToken[] {
  const byMint = new Map<string, DexPair>();
  for (const p of pairs) {
    const mint = p.baseToken.address;
    const existing = byMint.get(mint);
    const vol = p.volume?.h24 ?? 0;
    const existingVol = existing?.volume?.h24 ?? 0;
    if (!existing || vol > existingVol) byMint.set(mint, p);
  }

  return Array.from(byMint.values()).map((p) => {
    const name = p.baseToken.name || p.baseToken.symbol || "Unknown";
    const symbol = p.baseToken.symbol || "???";
    const priceUsd = p.priceUsd ? parseFloat(p.priceUsd) : undefined;
    const vol24h = p.volume?.h24;
    const nameMatch = keywords.length ? matchTokenToKeywords(name, symbol, keywords) : true;
    const volumeWeight = vol24h ? Math.min(vol24h / 100_000, 1) * 0.5 : 0;
    const relevanceScore = (nameMatch ? 0.5 : 0) + volumeWeight;

    return {
      mint: p.baseToken.address,
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

  if (!hasExplicitKeywords) {
    try {
      const boosted = await getLatestBoostedTokens();
      const solanaMints = boosted.slice(0, 16).map((t) => t.tokenAddress);
      const allPairs: DexPair[] = [];
      for (const mint of solanaMints) {
        const pairs = await searchPairs(mint);
        if (pairs.length > 0) {
          const best = pairs.reduce((a, b) => ((a.volume?.h24 ?? 0) > (b.volume?.h24 ?? 0) ? a : b));
          allPairs.push(best);
        }
      }
      const surfaced = pairsToSurfacedTokens(allPairs, []);
      if (surfaced.length > 0) {
        return surfaced
          .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
          .slice(0, 24);
      }
    } catch (e) {
      console.warn("[tokens] Latest boosted fetch failed, falling back:", e);
    }
  }

  if (keywords.length > 0) {
    try {
      const searchTerms = keywords.slice(0, 5);
      const allPairs: DexPair[] = [];
      for (const term of searchTerms) {
        const pairs = await searchPairs(term);
        allPairs.push(...pairs);
      }
      const surfaced = pairsToSurfacedTokens(allPairs, keywords);
      if (surfaced.length > 0) {
        return surfaced
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 24);
      }
    } catch (e) {
      console.warn("[tokens] DexScreener search failed, using mock:", e);
    }
  }

  const scored: SurfacedToken[] = MOCK_TOKENS.map((t) => {
    const nameMatch = keywords.length ? matchTokenToKeywords(t.name, t.symbol, keywords) : true;
    const volumeWeight = Math.min((t.volume24h ?? 0) / 200, 1) * 0.3;
    const ctWeight = Math.min((t.ctMentions ?? 0) / 500, 1) * 0.3;
    const relevanceScore = (nameMatch ? 0.4 : 0) + volumeWeight + ctWeight;
    return {
      ...t,
      relevanceScore,
      matchType: nameMatch ? "name" : "volume",
    };
  });

  return scored
    .filter((t) => t.relevanceScore > 0.2 || keywords.length === 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
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

/** Get token metadata and price by mint (DexScreener token-pairs). */
export async function getTokenInfoByMint(mint: string): Promise<TokenInfo | null> {
  try {
    const pairs = await getTokenPairs(mint);
    if (pairs.length === 0) return null;
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
  } catch {
    return null;
  }
}
