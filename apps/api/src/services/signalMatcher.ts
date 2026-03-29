import type { SurfacedToken } from "@siren/shared";
import { extractKeywordsFromTitle, getSurfacedTokens } from "./tokens.js";

const MATCH_CACHE_MS = 60 * 1000;
const matchCache = new Map<string, { expiresAt: number; value: SurfacedToken[] }>();

export async function getMatchedTokensForQuestion(question: string): Promise<SurfacedToken[]> {
  const keywords = extractKeywordsFromTitle(question);
  if (keywords.length === 0) return [];

  const cacheKey = keywords.join(",");
  const cached = matchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const matched = await getSurfacedTokens(undefined, undefined, cacheKey);
    const trimmed = matched.slice(0, 6);
    matchCache.set(cacheKey, {
      expiresAt: Date.now() + MATCH_CACHE_MS,
      value: trimmed,
    });
    return trimmed;
  } catch (error) {
    console.warn(
      "[signals] token matching failed:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
