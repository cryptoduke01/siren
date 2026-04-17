const JUPITER_PREDICTION_BASE = "https://api.jup.ag/prediction/v1";
const JUPITER_PREDICTION_TIMEOUT_MS = 8_000;
const JUPITER_PREDICTION_CACHE_MS = 5 * 60 * 1000;
const JUPITER_SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "market",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "who",
  "will",
  "with",
]);
const jupiterPredictionCache = new Map<string, { expiresAt: number; value: unknown }>();

type JupiterPredictionProvider = "kalshi" | "polymarket";

type JupiterPredictionSearchResponse = {
  data?: Array<{
    eventId?: string;
    isActive?: boolean;
    isLive?: boolean;
    category?: string;
    subcategory?: string;
    volumeUsd?: string | number;
    volume24hr?: string | number;
    metadata?: {
      title?: string;
      subtitle?: string;
      slug?: string;
      series?: string;
      closeTime?: string;
      imageUrl?: string;
    };
  }>;
};

type JupiterPredictionEventDetailResponse = {
  eventId?: string;
  isActive?: boolean;
  isLive?: boolean;
  category?: string;
  subcategory?: string;
  volumeUsd?: string | number;
  volume24hr?: string | number;
  metadata?: {
    title?: string;
    subtitle?: string;
    slug?: string;
    series?: string;
    closeTime?: string;
    imageUrl?: string;
  };
  markets?: Array<{
    marketId?: string;
    status?: string;
    result?: string | null;
    title?: string;
    openTime?: number;
    closeTime?: number;
    isTeamMarket?: boolean;
    rulesPrimary?: string;
    pricing?: {
      buyYesPriceUsd?: number;
      buyNoPriceUsd?: number;
      sellYesPriceUsd?: number;
      sellNoPriceUsd?: number;
      volume?: number;
    };
  }>;
};

type JupiterPredictionTradingStatus = {
  trading_active?: boolean;
};

type JupiterPredictionOrderbookResponse = {
  yes?: Array<[number | string, number]>;
  no?: Array<[number | string, number]>;
  yes_dollars?: Array<[number | string, number]>;
  no_dollars?: Array<[number | string, number]>;
};

export type JupiterPredictionDepthLevel = {
  priceUsd: number;
  quantity: number;
};

export type JupiterPredictionComparableMarket = {
  marketId: string;
  title: string;
  status: string;
  closeTime: number | null;
  yesPriceUsd: number | null;
  noPriceUsd: number | null;
  sellYesPriceUsd: number | null;
  sellNoPriceUsd: number | null;
  volume: number | null;
  marketUrl: string | null;
  orderbook: {
    bestYesBidUsd: number | null;
    bestNoBidUsd: number | null;
    yesDepth: JupiterPredictionDepthLevel[];
    noDepth: JupiterPredictionDepthLevel[];
    yesTopDepthContracts: number;
    noTopDepthContracts: number;
  } | null;
  comparison: {
    targetProbabilityPct: number | null;
    yesPriceGapPct: number | null;
    summary: string;
    confidence: "high" | "medium" | "low";
  };
  recommendation: string;
};

export type JupiterPredictionComparableEvent = {
  eventId: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  eventUrl: string | null;
  series: string | null;
  closeTime: string | null;
  imageUrl: string | null;
  volumeUsd: number | null;
  volume24hUsd: number | null;
  isLive: boolean;
  isActive: boolean;
  marketCount: number;
  markets: JupiterPredictionComparableMarket[];
  primaryMarket: JupiterPredictionComparableMarket | null;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseMicroUsd(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  return Number((parsed / 1_000_000).toFixed(4));
}

function normalizeProbability(targetProbability?: number | null): number | null {
  if (targetProbability == null || !Number.isFinite(targetProbability)) return null;
  return Math.max(0, Math.min(100, targetProbability));
}

function normalizePriceMicros(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number((value / 1_000_000).toFixed(4));
}

function providerBaseUrl(provider: JupiterPredictionProvider): string {
  return provider === "polymarket" ? "https://polymarket.com" : "https://kalshi.com";
}

function buildProviderEventUrl(provider: JupiterPredictionProvider, slug?: string | null): string | null {
  const cleanedSlug = slug?.trim();
  if (!cleanedSlug) return null;
  return provider === "polymarket"
    ? `${providerBaseUrl(provider)}/event/${cleanedSlug}`
    : `${providerBaseUrl(provider)}/markets/${cleanedSlug}`;
}

function buildProviderMarketUrl(provider: JupiterPredictionProvider, slug?: string | null, marketId?: string | null): string | null {
  const eventUrl = buildProviderEventUrl(provider, slug);
  if (!eventUrl) return null;
  const cleanedMarketId = marketId?.trim();
  if (!cleanedMarketId || provider === "polymarket") return eventUrl;
  return `${eventUrl}?market=${encodeURIComponent(cleanedMarketId)}`;
}

function normalizeDepthLevels(side: Array<[number | string, number]> | undefined): JupiterPredictionDepthLevel[] {
  return (side ?? [])
    .slice(0, 3)
    .map(([price, quantity]) => ({
      priceUsd:
        typeof price === "string"
          ? Number.parseFloat(price)
          : Number.isFinite(price)
            ? price / 100
            : 0,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    }))
    .filter((level) => Number.isFinite(level.priceUsd) && level.priceUsd > 0 && Number.isFinite(level.quantity) && level.quantity > 0);
}

function sumContracts(levels: JupiterPredictionDepthLevel[]): number {
  return Number(levels.reduce((sum, level) => sum + level.quantity, 0).toFixed(2));
}

function buildKeywordSet(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function matchConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function scoreMarketCandidate({
  eventTitle,
  marketTitle,
  outcomeLabel,
  targetProbability,
  yesPriceUsd,
}: {
  eventTitle: string;
  marketTitle: string;
  outcomeLabel?: string | null;
  targetProbability?: number | null;
  yesPriceUsd?: number | null;
}): number {
  const eventWords = new Set(buildKeywordSet(eventTitle));
  const marketWords = buildKeywordSet(marketTitle);
  const outcomeWords = buildKeywordSet(outcomeLabel ?? "");

  let score = 0;

  for (const word of marketWords) {
    if (outcomeWords.includes(word)) score += 3;
    else if (eventWords.has(word)) score += 1;
  }

  const normalizedProbability = normalizeProbability(targetProbability);
  if (normalizedProbability != null && yesPriceUsd != null) {
    const priceGap = Math.abs(normalizedProbability - yesPriceUsd * 100);
    if (priceGap <= 4) score += 4;
    else if (priceGap <= 10) score += 2;
    else if (priceGap <= 20) score += 1;
  }

  return score;
}

function buildComparisonSummary({
  provider,
  marketTitle,
  targetProbability,
  yesPriceUsd,
  yesDepthContracts,
}: {
  provider: JupiterPredictionProvider;
  marketTitle: string;
  targetProbability: number | null;
  yesPriceUsd: number | null;
  yesDepthContracts: number;
}): {
  targetProbabilityPct: number | null;
  yesPriceGapPct: number | null;
  summary: string;
  confidence: "high" | "medium" | "low";
} {
  const providerLabel = provider === "kalshi" ? "Kalshi" : "Polymarket";
  if (targetProbability == null || yesPriceUsd == null) {
    return {
      targetProbabilityPct: targetProbability,
      yesPriceGapPct: null,
      confidence: "low" as const,
      summary: `${providerLabel} surfaced ${marketTitle}, but Siren does not have a clean price anchor for the current outcome yet.`,
    };
  }

  const venueProbability = yesPriceUsd * 100;
  const gap = Number((venueProbability - targetProbability).toFixed(1));
  const absGap = Math.abs(gap);
  const confidence = matchConfidence((yesDepthContracts >= 5000 ? 4 : yesDepthContracts >= 1000 ? 2 : 1) + (absGap <= 4 ? 4 : absGap <= 10 ? 2 : 1));

  const summary =
    absGap <= 4
      ? `${providerLabel} is pricing ${marketTitle} almost in line with Siren's current read, which makes it a credible cross-venue benchmark.`
      : gap > 0
        ? `${providerLabel} is pricing ${marketTitle} about ${absGap.toFixed(1)} points richer on YES than Siren, so this venue is the hotter tape right now.`
        : `${providerLabel} is pricing ${marketTitle} about ${absGap.toFixed(1)} points cheaper on YES than Siren, so the venue read is softer here.`;

  return { targetProbabilityPct: targetProbability, yesPriceGapPct: gap, confidence, summary };
}

function buildRecommendation({
  provider,
  marketTitle,
  comparisonSummary,
  yesDepthContracts,
  noDepthContracts,
}: {
  provider: JupiterPredictionProvider;
  marketTitle: string;
  comparisonSummary: ReturnType<typeof buildComparisonSummary>;
  yesDepthContracts: number;
  noDepthContracts: number;
}) {
  const providerLabel = provider === "kalshi" ? "Kalshi" : "Polymarket";
  if (!comparisonSummary.summary) {
    return `Open ${providerLabel} directly for the cleanest venue-native read on ${marketTitle}.`;
  }
  if (Math.max(yesDepthContracts, noDepthContracts) < 500) {
    return `${providerLabel} found a matching market, but visible bid depth is still light. Treat it as a price reference before you trust it for size.`;
  }
  if (comparisonSummary.yesPriceGapPct != null && Math.abs(comparisonSummary.yesPriceGapPct) >= 10) {
    return `${providerLabel} is materially off Siren's current tape. Use it to check thesis drift, not as a blind substitute route.`;
  }
  return `${providerLabel} is close enough on pricing and depth to use as a serious cross-venue execution checkpoint for ${marketTitle}.`;
}

async function fetchPredictionJson<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const apiKey = process.env.JUPITER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example).");
  }

  const url = new URL(`${JUPITER_PREDICTION_BASE}${path}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  const cacheKey = url.toString();
  const cached = jupiterPredictionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JUPITER_PREDICTION_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && cached?.value) {
        return cached.value as T;
      }
      throw new Error(`Jupiter prediction request failed (${res.status})`);
    }

    const json = (await res.json()) as T;
    jupiterPredictionCache.set(cacheKey, {
      expiresAt: Date.now() + JUPITER_PREDICTION_CACHE_MS,
      value: json,
    });
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildJupiterPredictionQuery(title: string, outcomeLabel?: string | null): string {
  const cleaned = `${title} ${outcomeLabel ?? ""}`
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !JUPITER_SEARCH_STOPWORDS.has(word.toLowerCase()));

  const query = cleaned.slice(0, 8).join(" ").trim();
  return query || title.trim().slice(0, 180);
}

export async function getJupiterPredictionTradingStatus(): Promise<boolean> {
  const response = await fetchPredictionJson<JupiterPredictionTradingStatus>("/trading-status");
  return Boolean(response.trading_active);
}

export async function searchJupiterPredictionEvents({
  title,
  outcomeLabel,
  provider,
  targetProbability,
  limit = 2,
}: {
  title: string;
  outcomeLabel?: string | null;
  provider: JupiterPredictionProvider;
  targetProbability?: number | null;
  limit?: number;
}): Promise<{ query: string; events: JupiterPredictionComparableEvent[] }> {
  const query = buildJupiterPredictionQuery(title, outcomeLabel);
  if (!query) {
    return { query: "", events: [] };
  }

  const params = new URLSearchParams();
  params.set("provider", provider);
  params.set("query", query);
  params.set("limit", String(Math.min(Math.max(limit, 1), 4)));

  const payload = await fetchPredictionJson<JupiterPredictionSearchResponse>("/events/search", params);
  const searchRows = (payload.data ?? []).slice(0, limit);

  const events = await Promise.all(
    searchRows.map(async (searchRow): Promise<JupiterPredictionComparableEvent | null> => {
      const eventId = searchRow.eventId?.trim();
      if (!eventId) return null;

      const detail = await fetchPredictionJson<JupiterPredictionEventDetailResponse>(`/events/${encodeURIComponent(eventId)}`);
      const slug = detail.metadata?.slug?.trim() || searchRow.metadata?.slug?.trim() || null;
      const eventUrl = buildProviderEventUrl(provider, slug);
      const target = normalizeProbability(targetProbability);

      const comparableMarkets = await Promise.all(
        (detail.markets ?? []).slice(0, 3).map(async (market): Promise<JupiterPredictionComparableMarket | null> => {
          const marketId = market.marketId?.trim();
          if (!marketId) return null;

          const orderbook = await fetchPredictionJson<JupiterPredictionOrderbookResponse>(`/orderbook/${encodeURIComponent(marketId)}`).catch(() => null);
          const yesDepth = normalizeDepthLevels(orderbook?.yes_dollars ?? orderbook?.yes);
          const noDepth = normalizeDepthLevels(orderbook?.no_dollars ?? orderbook?.no);
          const yesTopDepthContracts = sumContracts(yesDepth);
          const noTopDepthContracts = sumContracts(noDepth);
          const yesPriceUsd = normalizePriceMicros(market.pricing?.buyYesPriceUsd ?? null);
          const noPriceUsd = normalizePriceMicros(market.pricing?.buyNoPriceUsd ?? null);
          const comparison = buildComparisonSummary({
            provider,
            marketTitle: market.title?.trim() || "Untitled market",
            targetProbability: target,
            yesPriceUsd,
            yesDepthContracts: yesTopDepthContracts,
          });

          return {
            marketId,
            title: market.title?.trim() || "Untitled market",
            status: market.status?.trim() || "unknown",
            closeTime: typeof market.closeTime === "number" ? market.closeTime : null,
            yesPriceUsd,
            noPriceUsd,
            sellYesPriceUsd: normalizePriceMicros(market.pricing?.sellYesPriceUsd ?? null),
            sellNoPriceUsd: normalizePriceMicros(market.pricing?.sellNoPriceUsd ?? null),
            volume: parseNumber(market.pricing?.volume),
            marketUrl: buildProviderMarketUrl(provider, slug, marketId),
            orderbook: orderbook
              ? {
                  bestYesBidUsd: yesDepth[0]?.priceUsd ?? null,
                  bestNoBidUsd: noDepth[0]?.priceUsd ?? null,
                  yesDepth,
                  noDepth,
                  yesTopDepthContracts,
                  noTopDepthContracts,
                }
              : null,
            comparison,
            recommendation: buildRecommendation({
              provider,
              marketTitle: market.title?.trim() || "Untitled market",
              comparisonSummary: comparison,
              yesDepthContracts: yesTopDepthContracts,
              noDepthContracts: noTopDepthContracts,
            }),
          };
        }),
      );

      const markets: JupiterPredictionComparableMarket[] = comparableMarkets.filter((market): market is JupiterPredictionComparableMarket => market != null);
      const primaryMarket =
        [...markets].sort((left, right) => {
          const leftScore = scoreMarketCandidate({
            eventTitle: detail.metadata?.title?.trim() || title,
            marketTitle: left.title,
            outcomeLabel,
            targetProbability: target,
            yesPriceUsd: left.yesPriceUsd,
          });
          const rightScore = scoreMarketCandidate({
            eventTitle: detail.metadata?.title?.trim() || title,
            marketTitle: right.title,
            outcomeLabel,
            targetProbability: target,
            yesPriceUsd: right.yesPriceUsd,
          });
          return rightScore - leftScore;
        })[0] ?? null;

      return {
        eventId,
        title: detail.metadata?.title?.trim() || searchRow.metadata?.title?.trim() || "Untitled event",
        subtitle: detail.metadata?.subtitle?.trim() || searchRow.metadata?.subtitle?.trim() || null,
        slug,
        eventUrl,
        series: detail.metadata?.series?.trim() || searchRow.metadata?.series?.trim() || null,
        closeTime: detail.metadata?.closeTime?.trim() || searchRow.metadata?.closeTime?.trim() || null,
        imageUrl: detail.metadata?.imageUrl?.trim() || searchRow.metadata?.imageUrl?.trim() || null,
        volumeUsd: parseMicroUsd(detail.volumeUsd ?? searchRow.volumeUsd),
        volume24hUsd: parseMicroUsd(detail.volume24hr ?? searchRow.volume24hr),
        isLive: Boolean(detail.isLive ?? searchRow.isLive),
        isActive: Boolean(detail.isActive ?? searchRow.isActive),
        marketCount: detail.markets?.length ?? 0,
        markets,
        primaryMarket,
      };
    }),
  );

  return {
    query,
    events: events.filter((event): event is JupiterPredictionComparableEvent => event != null),
  };
}
