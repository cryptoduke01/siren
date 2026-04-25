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

interface KalshiEventMarketMetadata {
  ticker: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  custom_strike?: Record<string, string>;
}

interface KalshiEventMetadata {
  event_ticker: string;
  title?: string;
  mutually_exclusive?: boolean;
  markets?: KalshiEventMarketMetadata[];
}

interface KalshiEventsResponse {
  cursor?: string | null;
  events?: KalshiEventMetadata[];
}

interface KalshiEventResponse {
  event?: KalshiEventMetadata;
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
const DFLOW_TIMEOUT_MS = 12_000;
let marketsCache: { expiresAt: number; value: MarketWithVelocity[] } | null = null;
let marketsInFlight: Promise<MarketWithVelocity[]> | null = null;
const MAX_TRADE_ACTIVITY_CACHE = 200;
const marketTradeActivityCache = new Map<string, { expiresAt: number; value: MarketTradeActivity }>();
const marketTradeActivityInFlight = new Map<string, Promise<MarketTradeActivity>>();
const kalshiEventMetadataCache = new Map<string, { expiresAt: number; value: KalshiEventMetadata | null }>();
const kalshiEventMetadataInFlight = new Map<string, Promise<KalshiEventMetadata | null>>();

function evictTradeActivityCache(): void {
  if (marketTradeActivityCache.size <= MAX_TRADE_ACTIVITY_CACHE) return;
  const now = Date.now();
  for (const [key, entry] of marketTradeActivityCache) {
    if (entry.expiresAt < now) marketTradeActivityCache.delete(key);
  }
  if (marketTradeActivityCache.size <= MAX_TRADE_ACTIVITY_CACHE) return;
  const toRemove = marketTradeActivityCache.size - MAX_TRADE_ACTIVITY_CACHE;
  const iter = marketTradeActivityCache.keys();
  for (let i = 0; i < toRemove; i++) {
    const key = iter.next().value;
    if (key) marketTradeActivityCache.delete(key);
  }
}

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

function normalizeTimestampMs(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function normalizeTickerKey(value?: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

function clampProbability(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

function quoteToProbability(yesBid?: string, yesAsk?: string): number {
  const bid = parseFiniteNumber(yesBid);
  const ask = parseFiniteNumber(yesAsk);
  if (bid != null && ask != null) return clampProbability(((bid + ask) / 2) * 100);
  if (bid != null) return clampProbability(bid * 100);
  if (ask != null) return clampProbability(ask * 100);
  return 50;
}

function normalizeLabelText(value?: string | null): string {
  return value?.replace(/\s+/g, " ").replace(/\?+$/, "").trim() ?? "";
}

function isGenericOutcomeLabel(label: string, eventTitle: string): boolean {
  const normalized = normalizeLabelText(label).toLowerCase();
  const normalizedEvent = normalizeLabelText(eventTitle).toLowerCase();
  if (!normalized) return true;
  if (normalized === normalizedEvent) return true;
  if (
    normalized === "who will" ||
    normalized === "who" ||
    normalized === "bitcoin" ||
    normalized === "ethereum" ||
    normalized === "president" ||
    normalized === "us government" ||
    normalized === "house control" ||
    normalized === "dem nominee"
  ) {
    return true;
  }
  return false;
}

function normalizeKalshiOutcomeLabel(
  eventTitle: string,
  marketTitle: string,
  yesSubtitle?: string,
  subtitle?: string,
  customStrikeLabel?: string,
): string {
  const preferred = [customStrikeLabel, yesSubtitle, subtitle]
    .map((value) => normalizeLabelText(value))
    .find((value) => value && !isGenericOutcomeLabel(value, eventTitle));
  if (preferred) return preferred;

  const cleanMarketTitle = marketTitle.trim();
  const cleanEventTitle = eventTitle.trim();
  if (!cleanMarketTitle) return cleanEventTitle || "Outcome";
  if (cleanMarketTitle.toLowerCase() === cleanEventTitle.toLowerCase()) return cleanMarketTitle;

  let label = cleanMarketTitle.replace(/\?+$/, "").trim();
  label = label.replace(/^will\s+/i, "");
  label = label.replace(/^the\s+/i, "");
  label = label.replace(/\s+be\b.*$/i, "");
  label = label.replace(/\s+win\b.*$/i, "");
  label = label.replace(/\s+become\b.*$/i, "");
  label = label.replace(/\s+have\b.*$/i, "");
  label = label.replace(/\s+reach\b.*$/i, "");
  label = label.replace(/\s+pass\b.*$/i, "");
  label = label.trim();

  const normalizedFallback = normalizeLabelText(label || cleanMarketTitle);
  return normalizedFallback || cleanEventTitle || "Outcome";
}

function getKalshiCustomStrikeLabel(market?: KalshiEventMarketMetadata): string | undefined {
  if (!market?.custom_strike) return undefined;
  const values = Object.values(market.custom_strike)
    .map((value) => normalizeLabelText(value))
    .filter(Boolean);
  return values[0];
}

function hasVisibleMarketSignal(market: DFlowMarketResponse): boolean {
  const now = Date.now();
  const closeMs = normalizeTimestampMs(market.closeTime);
  const openMs = normalizeTimestampMs(market.openTime);
  if (closeMs && closeMs <= now) return false;
  if (openMs && openMs > now) return false;

  const hasQuote =
    (parseFiniteNumber(market.yesBid) ?? 0) > 0 ||
    (parseFiniteNumber(market.yesAsk) ?? 0) > 0 ||
    (parseFiniteNumber(market.noBid) ?? 0) > 0 ||
    (parseFiniteNumber(market.noAsk) ?? 0) > 0;
  const hasFlow =
    (market.volume ?? 0) > 0 ||
    (parseFiniteNumber(market.volume24hFp) ?? 0) > 0 ||
    (market.openInterest ?? 0) > 0;

  return (
    hasQuote || hasFlow
  );
}

function cloneMarketOutcomeList(outcomes?: MarketOutcome[]): MarketOutcome[] | undefined {
  return outcomes?.map((outcome) => ({ ...outcome }));
}

function cloneMarket(market: MarketWithVelocity): MarketWithVelocity {
  return {
    ...market,
    outcomes: cloneMarketOutcomeList(market.outcomes),
  };
}

function applySelectedOutcome(market: MarketWithVelocity, outcomeTicker: string): MarketWithVelocity {
  const outcome = market.outcomes?.find((item) => normalizeTickerKey(item.ticker) === normalizeTickerKey(outcomeTicker));
  if (!outcome) return cloneMarket(market);

  return {
    ...cloneMarket(market),
    platform_id: outcome.ticker ?? market.platform_id,
    ticker: outcome.ticker ?? market.ticker,
    market_url: outcome.market_url ?? market.market_url,
    kalshi_url: outcome.market_url ?? market.kalshi_url,
    probability: outcome.probability ?? market.probability,
    subtitle: outcome.subtitle ?? market.subtitle,
    yes_mint: outcome.yes_mint,
    no_mint: outcome.no_mint,
    yes_token_id: outcome.yes_token_id,
    no_token_id: outcome.no_token_id,
    volume: outcome.volume ?? market.volume,
    volume_24h: outcome.volume_24h ?? market.volume_24h,
    liquidity: outcome.liquidity ?? market.liquidity,
    open_interest: outcome.open_interest ?? market.open_interest,
    selected_outcome_label: outcome.label,
  };
}

async function fetchKalshiEventMetadata(eventTicker: string): Promise<KalshiEventMetadata | null> {
  const normalizedTicker = eventTicker.trim().toUpperCase();
  if (!normalizedTicker) return null;

  const cached = kalshiEventMetadataCache.get(normalizedTicker);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = kalshiEventMetadataInFlight.get(normalizedTicker);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const res = await fetch(`${KALSHI_API_BASE}/events/${encodeURIComponent(normalizedTicker)}?with_nested_markets=true`, {
        signal: AbortSignal.timeout(DFLOW_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 429) throw new Error("Kalshi event API rate limited");
        throw new Error(`Kalshi event API error: ${res.status}`);
      }

      const json = (await res.json()) as KalshiEventResponse;
      const event = json.event ?? null;
      kalshiEventMetadataCache.set(normalizedTicker, {
        expiresAt: Date.now() + MARKETS_CACHE_MS,
        value: event,
      });
      return event;
    } finally {
      kalshiEventMetadataInFlight.delete(normalizedTicker);
    }
  })();

  kalshiEventMetadataInFlight.set(normalizedTicker, promise);
  return promise;
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
  try {
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
  } catch {
    return 0;
  }
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
      evictTradeActivityCache();
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

export async function getMarketByTicker(ticker: string): Promise<MarketWithVelocity | null> {
  const normalizedTicker = normalizeTickerKey(ticker);
  if (!normalizedTicker) return null;

  const markets = await getMarketsWithVelocity();

  const direct = markets.find((market) => {
    return [
      normalizeTickerKey(market.ticker),
      normalizeTickerKey(market.platform_id),
      normalizeTickerKey(market.event_ticker),
      normalizeTickerKey(market.condition_id),
    ].includes(normalizedTicker);
  });
  if (direct) {
    return cloneMarket(direct);
  }

  const grouped = markets.find((market) =>
    market.outcomes?.some((outcome) => normalizeTickerKey(outcome.ticker) === normalizedTicker),
  );
  if (grouped) {
    return applySelectedOutcome(grouped, normalizedTicker);
  }

  return null;
}

export async function getKalshiMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const events = await fetchAllActiveEvents();
  const markets: MarketWithVelocity[] = [];

  function buildOutcomeList(
    event: NonNullable<DFlowEventsResponse["events"]>[number],
    activeMarkets: DFlowMarketResponse[],
    seriesTicker: string,
    kalshiEvent?: KalshiEventMetadata | null,
  ): MarketOutcome[] {
    const eventMarketMeta = new Map(
      (kalshiEvent?.markets ?? []).map((market) => [market.ticker, market]),
    );

    return activeMarkets.map((m) => {
      const accountValues = m.accounts ? Object.values(m.accounts) : [];
      const firstAccount = accountValues.find((a) => a.yesMint && a.noMint);
      const kalshiMarket = eventMarketMeta.get(m.ticker);
      const label = normalizeKalshiOutcomeLabel(
        kalshiEvent?.title || event.title,
        kalshiMarket?.title || m.title || event.title,
        kalshiMarket?.yes_sub_title,
        kalshiMarket?.subtitle || m.subtitle,
        getKalshiCustomStrikeLabel(kalshiMarket),
      );
      const probability = quoteToProbability(m.yesBid, m.yesAsk);
      const seriesSlug = seriesTicker.toLowerCase();
      const marketTickerSlug = m.ticker.toLowerCase();
      const titleSlug = (label || m.title || event.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);
      const market_url = titleSlug
        ? `https://kalshi.com/markets/${seriesSlug}/${titleSlug}/${marketTickerSlug}`
        : `https://kalshi.com/markets/${seriesSlug}/${marketTickerSlug}`;

      return {
        label,
        probability,
        ticker: m.ticker,
        subtitle: m.subtitle || kalshiMarket?.subtitle,
        market_url,
        yes_mint: firstAccount?.yesMint,
        no_mint: firstAccount?.noMint,
        volume: m.volume,
        volume_24h: parseFiniteNumber(m.volume24hFp),
        open_interest: m.openInterest,
      };
    });
  }

  function hasLowQualityOutcomeLabels(outcomes: MarketOutcome[], eventTitle: string): boolean {
    if (outcomes.length <= 1) return false;
    const normalized = outcomes.map((outcome) => normalizeLabelText(outcome.label).toLowerCase());
    const uniqueCount = new Set(normalized).size;
    const genericCount = normalized.filter((label) => isGenericOutcomeLabel(label, eventTitle)).length;
    return uniqueCount <= Math.max(2, Math.floor(outcomes.length * 0.65)) || genericCount >= Math.ceil(outcomes.length / 3);
  }

  for (const event of events) {
    const eventMarkets = event.markets ?? [];
    const seriesTicker = event.seriesTicker ?? event.ticker?.split("-").slice(0, -1).join("-") ?? "";
    const activeMarkets = eventMarkets.filter((m) => m.status === "active" && hasVisibleMarketSignal(m));
    if (activeMarkets.length === 0) continue;

    let kalshiEvent: KalshiEventMetadata | null = null;
    let outcomes = buildOutcomeList(event, activeMarkets, seriesTicker);

    if (hasLowQualityOutcomeLabels(outcomes, event.title)) {
      kalshiEvent = await fetchKalshiEventMetadata(event.ticker).catch(() => null);
      if (kalshiEvent) {
        outcomes = buildOutcomeList(event, activeMarkets, seriesTicker, kalshiEvent);
      }
    }

    const isMultiOutcome = outcomes.length > 1;
    if (isMultiOutcome) {
      const cleanedOutcomes = outcomes.filter(
        (outcome) => !isGenericOutcomeLabel(outcome.label, kalshiEvent?.title || event.title),
      );
      if (cleanedOutcomes.length >= 2 && cleanedOutcomes.length >= Math.ceil(outcomes.length * 0.6)) {
        outcomes = cleanedOutcomes;
      }
      if (hasLowQualityOutcomeLabels(outcomes, kalshiEvent?.title || event.title)) {
        continue;
      }
      const leader = [...outcomes].sort((left, right) => {
        const byProbability = (right.probability ?? 0) - (left.probability ?? 0);
        if (Math.abs(byProbability) > 0.01) return byProbability;
        const byVolume = (right.volume ?? 0) - (left.volume ?? 0);
        if (Math.abs(byVolume) > 0) return byVolume;
        return (right.open_interest ?? 0) - (left.open_interest ?? 0);
      })[0];
      if (!leader) continue;

      markets.push({
        source: "kalshi",
        platform_id: leader.ticker ?? event.ticker,
        market_url: leader.market_url,
        ticker: leader.ticker ?? event.ticker,
        event_ticker: event.ticker,
        series_ticker: seriesTicker,
        title: kalshiEvent?.title || event.title,
        subtitle: `${outcomes.length} live outcomes`,
        status: "open",
        yes_bid: parseFiniteNumber(activeMarkets.find((market) => market.ticker === leader.ticker)?.yesBid),
        yes_ask: parseFiniteNumber(activeMarkets.find((market) => market.ticker === leader.ticker)?.yesAsk),
        volume: outcomes.reduce((sum, outcome) => sum + (outcome.volume ?? 0), 0),
        volume_24h: outcomes.reduce((sum, outcome) => sum + (outcome.volume_24h ?? 0), 0),
        liquidity: parseFiniteNumber(event.liquidity),
        open_interest: outcomes.reduce((sum, outcome) => sum + (outcome.open_interest ?? 0), 0),
        close_time: Math.max(...activeMarkets.map((market) => market.closeTime ?? 0)),
        open_time: Math.min(...activeMarkets.map((market) => market.openTime ?? Number.MAX_SAFE_INTEGER)),
        probability: leader.probability,
        velocity_1h: 0,
        yes_mint: leader.yes_mint,
        no_mint: leader.no_mint,
        kalshi_url: leader.market_url,
        outcomes,
        grouped_event: true,
        outcome_count: outcomes.length,
        selected_outcome_label: leader.label,
      });
      continue;
    }

    for (const m of activeMarkets) {
      const outcome = outcomes.find((item) => item.ticker === m.ticker);
      if (!outcome) continue;
      markets.push({
        source: "kalshi",
        platform_id: m.ticker,
        market_url: outcome.market_url,
        ticker: m.ticker,
        event_ticker: m.eventTicker,
        series_ticker: seriesTicker,
        title: m.title || event.title,
        subtitle: outcome.subtitle,
        status: "open",
        yes_bid: parseFiniteNumber(m.yesBid),
        yes_ask: parseFiniteNumber(m.yesAsk),
        volume: m.volume,
        volume_24h: parseFiniteNumber(m.volume24hFp) ?? parseFiniteNumber(event.volume24h),
        liquidity: parseFiniteNumber(event.liquidity),
        open_interest: m.openInterest,
        close_time: m.closeTime,
        open_time: m.openTime,
        probability: outcome.probability,
        velocity_1h: 0,
        yes_mint: outcome.yes_mint,
        no_mint: outcome.no_mint,
        kalshi_url: outcome.market_url,
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

function getMarketPriorityScore(market: MarketWithVelocity): number {
  const volumeBase = Math.max(0, market.volume_24h ?? market.volume ?? 0);
  const depthBase = Math.max(0, market.source === "polymarket" ? market.liquidity ?? 0 : market.open_interest ?? 0);
  const quoteBonus =
    ((market.yes_bid ?? 0) > 0 ? 1 : 0) +
    ((market.yes_ask ?? 0) > 0 ? 1 : 0) +
    ((market.no_bid ?? 0) > 0 ? 1 : 0) +
    ((market.no_ask ?? 0) > 0 ? 1 : 0);

  let freshnessWeight = 0.5;
  if (market.close_time) {
    const closeMs = market.close_time < 1_000_000_000_000 ? market.close_time * 1000 : market.close_time;
    const hours = (closeMs - Date.now()) / (1000 * 60 * 60);
    if (hours <= 0) return -1;
    if (hours <= 1) freshnessWeight = 0.2;
    else if (hours <= 24) freshnessWeight = 1.35;
    else if (hours <= 24 * 7) freshnessWeight = 1.15;
    else if (hours <= 24 * 30) freshnessWeight = 0.9;
    else if (hours <= 24 * 90) freshnessWeight = 0.45;
    else if (hours <= 24 * 180) freshnessWeight = 0.22;
    else if (hours <= 24 * 365) freshnessWeight = 0.1;
    else freshnessWeight = 0.04;
  }

  return freshnessWeight * (
    Math.log1p(volumeBase) * 1.7 +
    Math.log1p(depthBase) * 1.25 +
    Math.abs(market.velocity_1h ?? 0) * 2.5 +
    quoteBonus * 2
  );
}

async function getPolymarketMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const markets = await getActiveMarkets();
  const now = Date.now();

  return markets
    .filter((market) => {
      const closeMs = parseTimestamp(market.endDate);
      if (closeMs && closeMs <= now) return false;
      const openMs = parseTimestamp(market.startDate);
      if (openMs && openMs > now) return false;
      return market.question && ((market.volume ?? 0) > 0 || (market.liquidity ?? 0) > 0);
    })
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
        title: market.question || market.groupItemTitle || "Polymarket market",
        subtitle: market.groupItemTitle && market.groupItemTitle !== market.question ? market.groupItemTitle : undefined,
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

      const sorted = [...combined].sort((left, right) => {
        const scoreDiff = getMarketPriorityScore(right) - getMarketPriorityScore(left);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        const velocityDiff = Math.abs(right.velocity_1h ?? 0) - Math.abs(left.velocity_1h ?? 0);
        if (Math.abs(velocityDiff) > 0.01) return velocityDiff;
        return (right.volume_24h ?? right.volume ?? 0) - (left.volume_24h ?? left.volume ?? 0);
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
