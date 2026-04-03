import type { MarketTradeActivity, MarketWithVelocity, MarketOutcome } from "@siren/shared";
import { getActiveMarkets } from "../lib/polymarket.js";

const DFLOW_METADATA_URL =
  process.env.DFLOW_METADATA_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://e.prediction-markets-api.dflow.net"
    : "https://dev-prediction-markets-api.dflow.net");
const DFLOW_API_KEY = process.env.DFLOW_API_KEY || "";
const KALSHI_API_BASE = process.env.KALSHI_API_BASE_URL || "https://api.elections.kalshi.com/trade-api/v2";

interface DFlowAccountInfo {
  yesMint?: string;
  noMint?: string;
  isInitialized?: boolean;
}

interface DFlowMarketResponse {
  ticker: string;
  eventTicker: string;
  marketType?: string;
  title: string;
  subtitle?: string;
  yesBid?: string;
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  volume: number;
  volume24hFp?: string;
  openInterest: number;
  openTime?: number;
  closeTime?: number;
  status: string;
  accounts?: Record<string, DFlowAccountInfo>;
}

interface DFlowEventsResponse {
  events?: Array<{
    ticker: string;
    seriesTicker?: string;
    title: string;
    volume24h?: number;
    liquidity?: number;
    markets?: DFlowMarketResponse[];
  }>;
  cursor?: number | null;
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (DFLOW_API_KEY) headers["x-api-key"] = DFLOW_API_KEY;

interface DFlowCandlestick {
  price?: {
    close_dollars?: string;
    open_dollars?: string;
    previous_dollars?: string;
  };
}

interface DFlowCandlestickResponse {
  candlesticks?: DFlowCandlestick[];
}

interface KalshiTrade {
  created_time?: string;
}

interface KalshiTradesResponse {
  cursor?: string;
  trades?: KalshiTrade[];
}

const MARKETS_CACHE_MS = 60 * 1000;
const EVENT_PAGE_LIMIT = 200;
const MAX_EVENT_PAGES = 2;
const VELOCITY_FETCH_LIMIT = 12;
const MARKET_ACTIVITY_CACHE_MS = 60 * 1000;
const KALSHI_TRADES_PAGE_LIMIT = 1000;
const KALSHI_TRADES_MAX_PAGES = 12;
const DFLOW_TIMEOUT_MS = 5_000;
let marketsCache: { expiresAt: number; value: MarketWithVelocity[] } | null = null;
let marketsInFlight: Promise<MarketWithVelocity[]> | null = null;
const marketTradeActivityCache = new Map<string, { expiresAt: number; value: MarketTradeActivity }>();
const marketTradeActivityInFlight = new Map<string, Promise<MarketTradeActivity>>();

function parseDollarPrice(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFiniteNumber(value?: string | number | null): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampProbability(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

async function fetchAllActiveEvents(): Promise<NonNullable<DFlowEventsResponse["events"]>> {
  const events: NonNullable<DFlowEventsResponse["events"]> = [];
  let cursor: number | null | undefined = 0;
  let pageCount = 0;

  while (cursor !== null && pageCount < MAX_EVENT_PAGES) {
    const qs = new URLSearchParams({
      withNestedMarkets: "true",
      status: "active",
      limit: String(EVENT_PAGE_LIMIT),
    });
    if (cursor && cursor > 0) qs.set("cursor", String(cursor));
    const url = `${DFLOW_METADATA_URL}/api/v1/events?${qs.toString()}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(DFLOW_TIMEOUT_MS),
      });
    } catch (error) {
      if (events.length > 0) break;
      throw error;
    }
    if (!res.ok) {
      if (events.length > 0) break;
      if (res.status === 429) throw new Error("DFlow metadata rate limited. Try again in a few seconds.");
      throw new Error(`DFlow API error: ${res.status}`);
    }
    const json = (await res.json()) as DFlowEventsResponse;
    events.push(...(json.events ?? []));
    cursor = json.cursor ?? null;
    pageCount += 1;
  }

  return events;
}

async function fetchMarketVelocity1h(ticker: string): Promise<number> {
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - 2 * 60 * 60;
  const qs = new URLSearchParams({
    startTs: String(startTs),
    endTs: String(endTs),
    periodInterval: "60",
  });
  const res = await fetch(`${DFLOW_METADATA_URL}/api/v1/market/${encodeURIComponent(ticker)}/candlesticks?${qs.toString()}`, {
    headers,
    signal: AbortSignal.timeout(DFLOW_TIMEOUT_MS),
  });
  if (res.status === 429) return 0;
  if (!res.ok) return 0;
  const json = (await res.json()) as DFlowCandlestickResponse;
  const candles = json.candlesticks ?? [];
  const latest = candles.at(-1);
  if (!latest?.price) return 0;

  const current =
    parseDollarPrice(latest.price.close_dollars) ??
    parseDollarPrice(latest.price.open_dollars);
  const previous =
    parseDollarPrice(candles.at(-2)?.price?.close_dollars) ??
    parseDollarPrice(latest.price.previous_dollars) ??
    parseDollarPrice(latest.price.open_dollars);

  if (!current || !previous || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

export async function getMarketTradeActivity(ticker: string): Promise<MarketTradeActivity> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error("ticker required");
  }

  const cached = marketTradeActivityCache.get(normalizedTicker);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = marketTradeActivityInFlight.get(normalizedTicker);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const nowMs = Date.now();
      const cutoff24hMs = nowMs - 24 * 60 * 60 * 1000;
      const cutoff1hMs = nowMs - 60 * 60 * 1000;
      let cursor: string | undefined;
      let recentTrades24h = 0;
      let recentTrades1h = 0;
      let lastTradeAt: string | undefined;

      for (let page = 0; page < KALSHI_TRADES_MAX_PAGES; page += 1) {
        const qs = new URLSearchParams({
          ticker: normalizedTicker,
          limit: String(KALSHI_TRADES_PAGE_LIMIT),
          min_ts: String(Math.floor(cutoff24hMs / 1000)),
        });
        if (cursor) qs.set("cursor", cursor);

        const res = await fetch(`${KALSHI_API_BASE}/markets/trades?${qs.toString()}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          if (res.status === 429) throw new Error("Kalshi trades API rate limited");
          throw new Error(`Kalshi trades API error: ${res.status}`);
        }

        const json = (await res.json()) as KalshiTradesResponse;
        const trades = json.trades ?? [];
        if (!trades.length) break;

        if (!lastTradeAt) {
          lastTradeAt = trades[0]?.created_time;
        }

        for (const trade of trades) {
          const createdAtMs = parseTimestamp(trade.created_time);
          if (!createdAtMs) continue;
          if (createdAtMs >= cutoff24hMs) recentTrades24h += 1;
          if (createdAtMs >= cutoff1hMs) recentTrades1h += 1;
        }

        cursor = json.cursor?.trim() || undefined;
        if (!cursor) break;

        const oldestTradeMs = parseTimestamp(trades.at(-1)?.created_time);
        if (oldestTradeMs && oldestTradeMs < cutoff24hMs) break;
      }

      const value: MarketTradeActivity = {
        ticker: normalizedTicker,
        tradeCount1h: recentTrades1h,
        tradeCount24h: recentTrades24h,
        lastTradeAt: lastTradeAt,
      };
      marketTradeActivityCache.set(normalizedTicker, {
        expiresAt: Date.now() + MARKET_ACTIVITY_CACHE_MS,
        value,
      });
      return value;
    } catch (error) {
      const stale = marketTradeActivityCache.get(normalizedTicker);
      if (stale?.value) return stale.value;
      throw error;
    } finally {
      marketTradeActivityInFlight.delete(normalizedTicker);
    }
  })();

  marketTradeActivityInFlight.set(normalizedTicker, promise);
  return promise;
}

async function getKalshiMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const events = await fetchAllActiveEvents();
  const markets: MarketWithVelocity[] = [];

  for (const event of events) {
    const eventMarkets = event.markets ?? [];
    const seriesTicker = event.seriesTicker ?? event.ticker?.split("-").slice(0, -1).join("-") ?? "";
    const activeMarkets = eventMarkets.filter((m) => m.status === "active" && (m.volume ?? 0) > 0);
    if (activeMarkets.length === 0) continue;

    const isMultiOutcome = activeMarkets.length > 1;
    const outcomes: MarketOutcome[] = isMultiOutcome
      ? activeMarkets.map((m) => {
          const yesBid = m.yesBid ? parseFloat(m.yesBid) : undefined;
          const yesAsk = m.yesAsk ? parseFloat(m.yesAsk) : undefined;
          const accountValues = m.accounts ? Object.values(m.accounts) : [];
          const firstAccount = accountValues.find((a) => a.yesMint && a.noMint);
          return {
            label: m.title,
            probability: clampProbability((yesBid ?? yesAsk ?? 0.5) * 100),
            ticker: m.ticker,
            yes_mint: firstAccount?.yesMint,
            no_mint: firstAccount?.noMint,
          };
        })
      : [];

    for (const m of activeMarkets) {
      const yesBid = m.yesBid ? parseFloat(m.yesBid) : undefined;
      const yesAsk = m.yesAsk ? parseFloat(m.yesAsk) : undefined;
      const prob = (yesBid ?? yesAsk ?? 0.5) * 100;

      const accountValues = m.accounts ? Object.values(m.accounts) : [];
      const firstAccount = accountValues.find((a) => a.yesMint && a.noMint);
      const yes_mint = firstAccount?.yesMint;
      const no_mint = firstAccount?.noMint;

      const seriesSlug = seriesTicker.toLowerCase();
      const marketTickerSlug = m.ticker.toLowerCase();
      const titleSlug = (m.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);
      const kalshi_url = titleSlug
        ? `https://kalshi.com/markets/${seriesSlug}/${titleSlug}/${marketTickerSlug}`
        : `https://kalshi.com/markets/${seriesSlug}/${marketTickerSlug}`;

      markets.push({
        source: "kalshi",
        platform_id: m.ticker,
        market_url: kalshi_url,
        ticker: m.ticker,
        event_ticker: m.eventTicker,
        series_ticker: seriesTicker,
        title: isMultiOutcome ? `${event.title}: ${m.title}` : m.title,
        subtitle: m.subtitle,
        status: "open",
        yes_bid: yesBid,
        yes_ask: yesAsk,
        volume: m.volume,
        volume_24h: parseFiniteNumber(m.volume24hFp) ?? parseFiniteNumber(event.volume24h),
        liquidity: parseFiniteNumber(event.liquidity),
        open_interest: m.openInterest,
        close_time: m.closeTime,
        open_time: m.openTime,
        probability: prob,
        velocity_1h: 0,
        yes_mint,
        no_mint,
        kalshi_url,
        outcomes: isMultiOutcome ? outcomes : undefined,
      });
    }
  }

  const velocityCandidates = [...markets]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, VELOCITY_FETCH_LIMIT);

  for (let i = 0; i < velocityCandidates.length; i += 12) {
    const batch = velocityCandidates.slice(i, i + 12);
    const velocities = await Promise.all(batch.map((market) => fetchMarketVelocity1h(market.ticker)));
    batch.forEach((market, index) => {
      market.velocity_1h = velocities[index] ?? 0;
    });
  }

  return markets;
}

async function getPolymarketMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const markets = await getActiveMarkets();

  return markets
    .filter((market) => market.question && ((market.volume ?? 0) > 0 || (market.liquidity ?? 0) > 0))
    .map((market) => {
      const marketUrl = market.slug ? `https://polymarket.com/event/${market.slug}` : "https://polymarket.com";
      const probability = clampProbability((market.outcomePrices[0] ?? 0.5) * 100);

      const isMultiOutcome = market.outcomePrices.length > 2 || (market.outcomeLabels.length > 2);
      const outcomes: MarketOutcome[] | undefined = isMultiOutcome
        ? market.outcomePrices.map((price, idx) => ({
            label: market.outcomeLabels[idx] ?? `Option ${idx + 1}`,
            probability: clampProbability(price * 100),
            yes_token_id: market.clobTokenIds[idx],
          }))
        : undefined;

      return {
        source: "polymarket",
        platform_id: market.id,
        market_url: marketUrl,
        market_slug: market.slug,
        condition_id: market.conditionId,
        ticker: `POLY-${market.id}`,
        event_ticker: market.slug?.toUpperCase() ?? `POLY-${market.id}`,
        series_ticker: "POLYMARKET",
        title: market.groupItemTitle || market.question,
        subtitle: "Polymarket live market",
        status: "open",
        yes_bid: market.bestBid,
        yes_ask: market.bestAsk,
        volume: market.volume,
        volume_24h: market.volume,
        liquidity: market.liquidity,
        open_interest: 0,
        close_time: parseTimestamp(market.endDate),
        open_time: parseTimestamp(market.startDate),
        probability,
        velocity_1h: 0,
        yes_token_id: market.clobTokenIds[0],
        no_token_id: market.clobTokenIds[1],
        outcomes,
      };
    });
}

/** Fetch markets from Kalshi and Polymarket, keeping both sources independent. */
export async function getMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  if (marketsCache && marketsCache.expiresAt > Date.now()) return marketsCache.value;
  if (marketsInFlight) return marketsInFlight;

  marketsInFlight = (async () => {
    try {
      const [kalshiResult, polymarketResult] = await Promise.allSettled([
        getKalshiMarketsWithVelocity(),
        getPolymarketMarketsWithVelocity(),
      ]);

      const combined: MarketWithVelocity[] = [];
      if (kalshiResult.status === "fulfilled") {
        combined.push(...kalshiResult.value);
      }
      if (polymarketResult.status === "fulfilled") {
        combined.push(...polymarketResult.value);
      }

      if (combined.length === 0) {
        if (marketsCache?.value?.length) {
          return marketsCache.value;
        }
        const reasons = [kalshiResult, polymarketResult]
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
        throw new Error(reasons.join(" | ") || "No markets available");
      }

      const sorted = combined.sort((a, b) => {
        const velocityDiff = Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h);
        if (velocityDiff !== 0) return velocityDiff;
        return (b.volume ?? 0) - (a.volume ?? 0);
      });

      marketsCache = {
        expiresAt: Date.now() + MARKETS_CACHE_MS,
        value: sorted,
      };
      return sorted;
    } catch (error) {
      if (marketsCache?.value?.length) {
        return marketsCache.value;
      }
      throw error;
    } finally {
      marketsInFlight = null;
    }
  })();

  return marketsInFlight;
}
