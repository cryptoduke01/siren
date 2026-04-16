import type { SurfacedToken, LaunchpadId } from "@siren/shared";
import { getKeywordsForCategory } from "@siren/shared";
import { matchTokenToKeywords } from "@siren/shared";
import { searchPairs, getTokenPairs, getLatestBoostedTokens } from "./dexscreener.js";
import type { DexPair } from "./dexscreener.js";
const SOL_MINT = "So11111111111111111111111111111111111111112";
type RiskLabel = "low" | "moderate" | "high" | "critical";
type BondingCurveStatus = "bonded" | "bonding" | "unknown";

interface RiskAnalysis {
  score: number;
  label: RiskLabel;
  reasons: string[];
  blocked: boolean;
}

interface RugcheckSummary {
  holders?: number;
  rugcheckScore?: number;
  safe?: boolean;
}

interface TokenEnrichment {
  imageUrl?: string;
  liquidityUsd?: number;
  fdvUsd?: number;
  holders?: number;
  bondingCurveStatus?: BondingCurveStatus;
  rugcheckScore?: number;
  safe?: boolean;
  risk: RiskAnalysis;
}

const RUGCHECK_CACHE_MS = 10 * 60 * 1000;
const RUGCHECK_TIMEOUT_MS = 6_000;
const JUPITER_TIMEOUT_MS = 8_000;
const TOKENS_CACHE_MS = 45 * 1000;
const TOKEN_HYDRATION_BATCH_SIZE = 6;
const DEFAULT_DISCOVERY_RESULT_LIMIT = 16;
const TARGETED_RESULT_LIMIT = 12;
const MAX_RUGCHECK_CACHE = 200;
const MAX_SURFACED_CACHE = 50;
const rugcheckCache = new Map<string, { expiry: number; value: RugcheckSummary | null }>();
const surfacedTokensCache = new Map<string, { expiresAt: number; value: SurfacedToken[] }>();
const surfacedTokensInFlight = new Map<string, Promise<SurfacedToken[]>>();

function evictMapByExpiry<T extends { expiry?: number; expiresAt?: number }>(
  map: Map<string, T>,
  maxSize: number,
): void {
  if (map.size <= maxSize) return;
  const now = Date.now();
  for (const [key, entry] of map) {
    const exp = (entry as { expiry?: number }).expiry ?? (entry as { expiresAt?: number }).expiresAt ?? Infinity;
    if (exp < now) map.delete(key);
  }
  if (map.size <= maxSize) {
    return;
  }
  const toRemove = map.size - maxSize;
  const iter = map.keys();
  for (let i = 0; i < toRemove; i++) {
    const key = iter.next().value;
    if (key) map.delete(key);
  }
}

/** Detect launchpad from mint suffix (Pump.fun: pump, Bonk.fun: bonk, Moonshot: shot). */
export function getLaunchpadFromMint(mint: string): LaunchpadId | undefined {
  const lower = mint.toLowerCase();
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

function normalizeDexImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `https://cdn.dexscreener.com/cms/images/${imageUrl}?width=800&height=800&quality=90`;
}

function parseUsd(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveBondingCurveStatus(params: { pair?: DexPair }): BondingCurveStatus {
  const dexId = params.pair?.dexId?.toLowerCase() ?? "";
  if (!dexId) return "unknown";
  if (dexId.includes("meteora") || dexId.includes("raydium") || dexId.includes("orca")) return "bonded";
  if (dexId.includes("pump") || dexId.includes("moonshot") || dexId.includes("bags")) return "bonding";
  return params.pair?.liquidity?.usd && params.pair.liquidity.usd > 0 ? "bonded" : "unknown";
}

async function getRugcheckSummary(mint: string): Promise<RugcheckSummary | null> {
  const cached = rugcheckCache.get(mint);
  if (cached && cached.expiry > Date.now()) return cached.value;
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(RUGCHECK_TIMEOUT_MS),
    });
    if (!res.ok) {
      rugcheckCache.set(mint, { expiry: Date.now() + RUGCHECK_CACHE_MS, value: null });
      return null;
    }
    const json = (await res.json()) as {
      totalHolders?: number;
      score?: number;
      score_normalised?: number;
      rugged?: boolean;
    };
    const rugcheckScore =
      typeof json.score_normalised === "number"
        ? json.score_normalised
        : typeof json.score === "number"
          ? json.score
          : undefined;
    const value: RugcheckSummary = {
      holders: typeof json.totalHolders === "number" ? json.totalHolders : undefined,
      rugcheckScore,
      safe:
        typeof json.rugged === "boolean"
          ? !json.rugged && (rugcheckScore == null || rugcheckScore < 60)
          : rugcheckScore == null
            ? undefined
            : rugcheckScore < 60,
    };
    rugcheckCache.set(mint, { expiry: Date.now() + RUGCHECK_CACHE_MS, value });
    evictMapByExpiry(rugcheckCache, MAX_RUGCHECK_CACHE);
    return value;
  } catch {
    rugcheckCache.set(mint, { expiry: Date.now() + RUGCHECK_CACHE_MS, value: null });
    evictMapByExpiry(rugcheckCache, MAX_RUGCHECK_CACHE);
    return null;
  }
}

function analyzeTokenRisk(params: {
  pair?: DexPair;
  mint: string;
  name: string;
  symbol: string;
  priceUsd?: number;
  volume24h?: number;
  imageUrl?: string;
}): RiskAnalysis {
  let score = 0;
  const reasons: string[] = [];
  const pair = params.pair;
  const liquidity = pair?.liquidity?.usd ?? 0;
  const volume24h = params.volume24h ?? 0;
  const symbol = params.symbol || "";
  const name = params.name || "";

  if (!pair) {
    score += 65;
    reasons.push("No live market pair");
  }
  if (!params.priceUsd || !Number.isFinite(params.priceUsd)) {
    score += 20;
    reasons.push("No reliable price data");
  }
  if (liquidity > 0 && liquidity < 500) {
    score += 35;
    reasons.push("Very low liquidity");
  } else if (liquidity > 0 && liquidity < 2_000) {
    score += 18;
    reasons.push("Thin liquidity");
  }
  if (volume24h > 0 && volume24h < 1_000) {
    score += 18;
    reasons.push("Low trading volume");
  } else if (volume24h > 0 && volume24h < 5_000) {
    score += 8;
    reasons.push("Limited trading volume");
  }
  if (!params.imageUrl) {
    score += 5;
    reasons.push("No token artwork");
  }
  if (symbol.length > 12 || /[^a-z0-9]/i.test(symbol) || name.length > 40) {
    score += 8;
    reasons.push("Unusual token metadata");
  }

  score = Math.max(0, Math.min(100, score));
  const label: RiskLabel = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "moderate" : "low";
  return {
    score,
    label,
    reasons: reasons.slice(0, 3),
    blocked: score >= 80,
  };
}

async function enrichToken(params: {
  mint: string;
  pair?: DexPair;
  name: string;
  symbol: string;
  priceUsd?: number;
}): Promise<TokenEnrichment> {
  const dexImageUrl = normalizeDexImageUrl(params.pair?.info?.imageUrl);
  const jup = !dexImageUrl ? await getJupiterTokenByMint(params.mint) : null;
  const imageUrl = dexImageUrl ?? jup?.imageUrl;
  const rugcheck = await getRugcheckSummary(params.mint);
  const liquidityUsd = params.pair?.liquidity?.usd;
  const fdvUsd = params.pair?.fdv ?? params.pair?.marketCap;
  const risk = analyzeTokenRisk({
    pair: params.pair,
    mint: params.mint,
    name: params.name,
    symbol: params.symbol,
    priceUsd: params.priceUsd,
    volume24h: params.pair?.volume?.h24,
    imageUrl,
  });
  return {
    imageUrl,
    liquidityUsd,
    fdvUsd,
    holders: rugcheck?.holders,
    bondingCurveStatus: deriveBondingCurveStatus({ pair: params.pair }),
    rugcheckScore: rugcheck?.rugcheckScore,
    safe: rugcheck?.safe ?? (risk.label === "low" || risk.label === "moderate"),
    risk,
  };
}

async function hydrateSurfacedTokens(
  tokens: SurfacedToken[],
  bestPairByMint: Map<string, DexPair>
): Promise<SurfacedToken[]> {
  const hydrated: SurfacedToken[] = [];

  for (let index = 0; index < tokens.length; index += TOKEN_HYDRATION_BATCH_SIZE) {
    const batch = tokens.slice(index, index + TOKEN_HYDRATION_BATCH_SIZE);
    const resolved = await Promise.all(
      batch.map(async (token) => {
        const bestPair = bestPairByMint.get(token.mint) ?? pickBestPair(await getTokenPairs(token.mint));
        const enrichment = await enrichToken({
          mint: token.mint,
          pair: bestPair,
          name: token.name,
          symbol: token.symbol,
          priceUsd: token.price,
        });
        return {
          ...token,
          imageUrl: enrichment.imageUrl ?? token.imageUrl,
          liquidityUsd: enrichment.liquidityUsd ?? token.liquidityUsd,
          fdvUsd: enrichment.fdvUsd ?? token.fdvUsd,
          holders: enrichment.holders ?? token.holders,
          bondingCurveStatus: enrichment.bondingCurveStatus ?? token.bondingCurveStatus,
          rugcheckScore: enrichment.rugcheckScore ?? token.rugcheckScore,
          safe: enrichment.safe ?? token.safe,
          riskScore: enrichment.risk.score,
          riskLabel: enrichment.risk.label,
          riskReasons: enrichment.risk.reasons,
          riskBlocked: enrichment.risk.blocked,
        };
      })
    );
    hydrated.push(...resolved);
  }

  return hydrated;
}

function applyInlineRisk(token: SurfacedToken, pair?: DexPair): SurfacedToken {
  const risk = analyzeTokenRisk({
    pair,
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    priceUsd: token.price,
    volume24h: token.volume24h,
    imageUrl: token.imageUrl,
  });

  return {
    ...token,
    safe: risk.label === "low" || risk.label === "moderate",
    riskScore: risk.score,
    riskLabel: risk.label,
    riskReasons: risk.reasons,
    riskBlocked: risk.blocked,
  };
}

function pairsToSurfacedTokens(bestPairByMint: Map<string, DexPair>, keywords: string[]): SurfacedToken[] {
  return Array.from(bestPairByMint.entries()).map(([mint, p]) => {
    const token = (p.baseToken.address === mint ? p.baseToken : p.quoteToken) as { address: string; symbol: string; name: string };
    const name = token.name || token.symbol || "Unknown";
    const symbol = token.symbol || "???";
    const priceUsd = parseUsd(p.priceUsd);
    const vol24h = p.volume?.h24;
    const nameMatch = keywords.length ? matchTokenToKeywords(name, symbol, keywords) : true;
    const volumeWeight = vol24h ? Math.min(vol24h / 250_000, 1) * 0.45 : 0;
    const liquidityWeight = p.liquidity?.usd ? Math.min(p.liquidity.usd / 250_000, 1) * 0.25 : 0;
    const keywordWeight = nameMatch ? 0.3 : 0;
    const relevanceScore = volumeWeight + liquidityWeight + keywordWeight;
    const matchType: "name" | "volume" | "ct" = nameMatch ? "name" : "volume";

    return {
      mint,
      name,
      symbol,
      price: priceUsd,
      volume24h: vol24h ? Math.round(vol24h) : undefined,
      imageUrl: normalizeDexImageUrl(p.info?.imageUrl),
      liquidityUsd: p.liquidity?.usd,
      fdvUsd: p.fdv ?? p.marketCap,
      relevanceScore,
      matchType,
      launchpad: getLaunchpadFromMint(mint),
    };
  });
}

const STOP_WORDS = new Set(["will", "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "any", "did", "let", "put", "say", "she", "too", "use", "from", "than", "that", "this", "with", "what", "when", "where", "which"]);
const DEFAULT_DISCOVERY_TERMS = ["bitcoin", "solana", "ethereum", "election", "sports"];

function parseKeywordsParam(param?: string): string[] {
  if (!param?.trim()) return [];
  return param.split(/[\s,]+/).filter((k) => k.length >= 2).slice(0, 5);
}

/** Solana address length (base58); used to route CA paste to direct pair lookup. */
function looksLikeSolanaMint(s: string): boolean {
  const t = s.trim();
  if (t.length < 32 || t.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

function buildSurfacedTokensCacheKey(marketId?: string, categoryId?: string, keywordsParam?: string): string {
  return JSON.stringify({
    marketId: marketId?.trim() || "",
    categoryId: categoryId?.trim() || "",
    keywords: parseKeywordsParam(keywordsParam).sort(),
  });
}

function pickBestPair(pairs: DexPair[]): DexPair | undefined {
  return pairs.reduce<DexPair | undefined>((best, pair) => {
    if (!best) return pair;
    return (pair.volume?.h24 ?? 0) > (best.volume?.h24 ?? 0) ? pair : best;
  }, undefined);
}

function buildBestPairByMint(pairs: DexPair[]): Map<string, DexPair> {
  const byMint = new Map<string, DexPair>();
  for (const pair of pairs) {
    const mint = tokenMintFromPair(pair);
    const existing = byMint.get(mint);
    if (!existing || (pair.volume?.h24 ?? 0) > (existing.volume?.h24 ?? 0)) {
      byMint.set(mint, pair);
    }
  }
  return byMint;
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
  const cacheKey = buildSurfacedTokensCacheKey(marketId, categoryId, keywordsParam);
  const cached = surfacedTokensCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = surfacedTokensInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const parsedKw = parseKeywordsParam(keywordsParam);
    const keywords =
      parsedKw.length > 0 ? parsedKw : categoryId ? getKeywordsForCategory(categoryId) : [];
    const isDefaultDiscovery = !marketId && !categoryId && keywords.length === 0;
    const directMint =
      !marketId && !categoryId && keywords.length === 1 && looksLikeSolanaMint(keywords[0])
        ? keywords[0].trim()
        : null;

    const allPairs: DexPair[] = [];
    const seenMints = new Set<string>();

    try {
      if (directMint) {
        try {
          const pairs = await getTokenPairs(directMint);
          const best = pickBestPair(pairs);
          if (best) {
            const map = buildBestPairByMint([best]);
            let surfaced = pairsToSurfacedTokens(map, [directMint]);
            surfaced = surfaced.map((t) => applyInlineRisk(t, best));
            const hydrated = await hydrateSurfacedTokens(surfaced, map);
            surfacedTokensCache.set(cacheKey, {
              expiresAt: Date.now() + TOKENS_CACHE_MS,
              value: hydrated,
            });
            evictMapByExpiry(surfacedTokensCache, MAX_SURFACED_CACHE);
            return hydrated;
          }
          const infoOnly = await getTokenInfoByMint(directMint);
          if (infoOnly) {
            const fallback: SurfacedToken = {
              mint: infoOnly.mint,
              name: infoOnly.name,
              symbol: infoOnly.symbol,
              price: infoOnly.priceUsd,
              volume24h: infoOnly.volume24h,
              imageUrl: infoOnly.imageUrl,
              liquidityUsd: infoOnly.liquidityUsd,
              fdvUsd: infoOnly.fdvUsd,
              relevanceScore: 1,
              matchType: "name",
              launchpad: getLaunchpadFromMint(directMint),
              riskScore: infoOnly.riskScore,
              riskLabel: infoOnly.riskLabel,
              riskReasons: infoOnly.riskReasons,
              riskBlocked: false,
              safe: infoOnly.safe,
            };
            surfacedTokensCache.set(cacheKey, {
              expiresAt: Date.now() + TOKENS_CACHE_MS,
              value: [fallback],
            });
            evictMapByExpiry(surfacedTokensCache, MAX_SURFACED_CACHE);
            return [fallback];
          }
        } catch (e) {
          console.warn("[tokens] direct CA lookup failed:", e);
        }
      }

      try {
        const boosted = await getLatestBoostedTokens();
        const boostedMints = boosted
          .slice(0, isDefaultDiscovery ? DEFAULT_DISCOVERY_RESULT_LIMIT : TARGETED_RESULT_LIMIT)
          .map((t) => t.tokenAddress)
          .filter((mint) => !seenMints.has(mint));
        const results = await Promise.all(boostedMints.map((mint) => getTokenPairs(mint)));
        for (let index = 0; index < boostedMints.length; index += 1) {
          const queriedMint = boostedMints[index];
          const best = pickBestPair(results[index]);
          if (best && !seenMints.has(queriedMint)) {
            seenMints.add(queriedMint);
            allPairs.push(best);
          }
        }
      } catch (e) {
        console.warn("[tokens] DexScreener boosted failed:", e);
      }

      const shouldRunDiscoverySearch = keywords.length > 0 || !marketId;
      if (shouldRunDiscoverySearch) {
        try {
          const searchTerms = (keywords.length > 0 ? keywords : DEFAULT_DISCOVERY_TERMS).slice(0, isDefaultDiscovery ? 3 : 5);
          const searchResults = await Promise.all(searchTerms.map((term) => searchPairs(term)));
          const keywordPairs: DexPair[] = searchResults.flat();
          for (const pair of keywordPairs) {
            const mint = tokenMintFromPair(pair);
            if (seenMints.has(mint)) continue;
            seenMints.add(mint);
            allPairs.push(pair);
          }
        } catch (e) {
          console.warn("[tokens] DexScreener search failed:", e);
        }
      }

      const bestPairByMint = buildBestPairByMint(allPairs);
      const surfaced = pairsToSurfacedTokens(bestPairByMint, keywords);
      const ranked = surfaced
        .sort((a, b) => {
          if (keywords.length > 0) return b.relevanceScore - a.relevanceScore;
          return (b.volume24h ?? 0) - (a.volume24h ?? 0);
        })
        .slice(0, isDefaultDiscovery ? DEFAULT_DISCOVERY_RESULT_LIMIT : TARGETED_RESULT_LIMIT)
        .map((token) => applyInlineRisk(token, bestPairByMint.get(token.mint)))
        .filter((token) => !token.riskBlocked);

      const filtered = isDefaultDiscovery
        ? ranked
        : (await hydrateSurfacedTokens(ranked, bestPairByMint)).filter((token) => !token.riskBlocked);

      surfacedTokensCache.set(cacheKey, {
        expiresAt: Date.now() + TOKENS_CACHE_MS,
        value: filtered,
      });
      evictMapByExpiry(surfacedTokensCache, MAX_SURFACED_CACHE);
      return filtered;
    } catch (error) {
      if (cached) return cached.value;
      throw error;
    } finally {
      surfacedTokensInFlight.delete(cacheKey);
    }
  })();

  surfacedTokensInFlight.set(cacheKey, promise);
  return promise;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd?: number;
  volume24h?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  holders?: number;
  bondingCurveStatus?: BondingCurveStatus;
  rugcheckScore?: number;
  safe?: boolean;
  riskScore?: number;
  riskLabel?: RiskLabel;
  riskReasons?: string[];
  riskBlocked?: boolean;
}

const JUPITER_TOKEN_LIST_URL = "https://tokens.jup.ag/tokens?tags=verified";
let jupiterTokenCache: Map<string, { name: string; symbol: string; logoURI?: string }> | null = null;
let jupiterCacheTime = 0;
const JUPITER_CACHE_MS = 60 * 60 * 1000;

async function getJupiterTokenByMint(mint: string): Promise<{ name: string; symbol: string; imageUrl?: string } | null> {
  try {
    if (!jupiterTokenCache || Date.now() - jupiterCacheTime > JUPITER_CACHE_MS) {
      const res = await fetch(JUPITER_TOKEN_LIST_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(JUPITER_TIMEOUT_MS),
      });
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
      const priceUsd = parseUsd(best.priceUsd);
      const enrichment = await enrichToken({
        mint,
        name: base.name || base.symbol || "Unknown",
        symbol: base.symbol || "???",
        pair: best,
        priceUsd,
      });
      return {
        mint,
        name: base.name || base.symbol || "Unknown",
        symbol: base.symbol || "???",
        imageUrl: enrichment.imageUrl,
        priceUsd,
        volume24h: best.volume?.h24 ? Math.round(best.volume.h24) : undefined,
        liquidityUsd: enrichment.liquidityUsd,
        fdvUsd: enrichment.fdvUsd,
        holders: enrichment.holders,
        bondingCurveStatus: enrichment.bondingCurveStatus,
        rugcheckScore: enrichment.rugcheckScore,
        safe: enrichment.safe,
        riskScore: enrichment.risk.score,
        riskLabel: enrichment.risk.label,
        riskReasons: enrichment.risk.reasons,
        riskBlocked: enrichment.risk.blocked,
      };
    }
    const jup = await getJupiterTokenByMint(mint);
    if (jup) {
      const enrichment = await enrichToken({
        mint,
        name: jup.name,
        symbol: jup.symbol,
      });
      return {
        mint,
        name: jup.name,
        symbol: jup.symbol,
        imageUrl: enrichment.imageUrl ?? jup.imageUrl,
        priceUsd: undefined,
        liquidityUsd: enrichment.liquidityUsd,
        fdvUsd: enrichment.fdvUsd,
        holders: enrichment.holders,
        bondingCurveStatus: enrichment.bondingCurveStatus,
        rugcheckScore: enrichment.rugcheckScore,
        safe: enrichment.safe,
        riskScore: enrichment.risk.score,
        riskLabel: enrichment.risk.label,
        riskReasons: enrichment.risk.reasons,
        riskBlocked: enrichment.risk.blocked,
      };
    }
    return null;
  } catch {
    return null;
  }
}
