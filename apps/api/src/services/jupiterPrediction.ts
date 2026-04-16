const JUPITER_PREDICTION_BASE = "https://api.jup.ag/prediction/v1/events/search";
const JUPITER_PREDICTION_TIMEOUT_MS = 8_000;
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

type JupiterPredictionProvider = "kalshi" | "polymarket";

type JupiterPredictionSearchResponse = {
  data?: Array<{
    eventId?: string;
    isActive?: boolean;
    isLive?: boolean;
    category?: string;
    subcategory?: string;
    volumeUsd?: string;
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
      closeTime?: number;
      metadata?: {
        title?: string;
        status?: string;
        closeTime?: number;
      };
      pricing?: {
        buyYesPriceUsd?: number;
        buyNoPriceUsd?: number;
        volume?: number;
      };
    }>;
  }>;
};

export type JupiterPredictionComparableMarket = {
  marketId: string;
  title: string;
  status: string;
  closeTime: number | null;
  yesPriceUsd: number | null;
  noPriceUsd: number | null;
  volume: number | null;
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
  isLive: boolean;
  isActive: boolean;
  marketCount: number;
  markets: JupiterPredictionComparableMarket[];
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

export async function searchJupiterPredictionEvents({
  title,
  outcomeLabel,
  provider,
  limit = 3,
}: {
  title: string;
  outcomeLabel?: string | null;
  provider: JupiterPredictionProvider;
  limit?: number;
}): Promise<{ query: string; events: JupiterPredictionComparableEvent[] }> {
  const apiKey = process.env.JUPITER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env (see .env.example).");
  }

  const query = buildJupiterPredictionQuery(title, outcomeLabel);
  if (!query) {
    return { query: "", events: [] };
  }

  const url = new URL(JUPITER_PREDICTION_BASE);
  url.searchParams.set("provider", provider);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 6)));

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
      throw new Error(`Jupiter prediction search failed (${res.status})`);
    }

    const payload = (await res.json()) as JupiterPredictionSearchResponse;
    const events = (payload.data ?? []).map((event) => ({
      eventId: event.eventId?.trim() || `${provider}-${event.metadata?.slug ?? "event"}`,
      title: event.metadata?.title?.trim() || "Untitled event",
      subtitle: event.metadata?.subtitle?.trim() || null,
      slug: event.metadata?.slug?.trim() || null,
      eventUrl: event.metadata?.slug?.trim()
        ? provider === "polymarket"
          ? `https://polymarket.com/event/${event.metadata.slug.trim()}`
          : `https://kalshi.com/markets/${event.metadata.slug.trim()}`
        : null,
      series: event.metadata?.series?.trim() || null,
      closeTime: event.metadata?.closeTime?.trim() || null,
      imageUrl: event.metadata?.imageUrl?.trim() || null,
      volumeUsd: parseNumber(event.volumeUsd),
      isLive: Boolean(event.isLive),
      isActive: Boolean(event.isActive),
      marketCount: event.markets?.length ?? 0,
      markets: (event.markets ?? []).slice(0, 3).map((market) => ({
        marketId: market.marketId?.trim() || "market",
        title: market.metadata?.title?.trim() || "Untitled market",
        status: market.metadata?.status?.trim() || market.status?.trim() || "unknown",
        closeTime: typeof market.metadata?.closeTime === "number" ? market.metadata.closeTime : typeof market.closeTime === "number" ? market.closeTime : null,
        yesPriceUsd: parseNumber(market.pricing?.buyYesPriceUsd),
        noPriceUsd: parseNumber(market.pricing?.buyNoPriceUsd),
        volume: parseNumber(market.pricing?.volume),
      })),
    }));

    return { query, events };
  } finally {
    clearTimeout(timeout);
  }
}
