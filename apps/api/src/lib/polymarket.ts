import type { PolymarketSignalCandidate } from "../types/polymarket.js";
import type {
  PolymarketDepositResponse,
  PolymarketGammaMarketResponse,
  PolymarketMarket,
  PolymarketOrderBook,
  PolymarketOrderBookLevel,
  PolymarketOrderBookResponse,
} from "../types/polymarket.js";
import { getProbabilitySnapshot60sAgo, saveProbabilitySnapshot } from "../services/signalState.js";

const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com/markets";
const POLYMARKET_HOST = process.env.POLYMARKET_HOST?.trim() || "https://clob.polymarket.com";
const POLYMARKET_BRIDGE_URL = "https://bridge.polymarket.com";
const POLYMARKET_MARKET_LIMIT = Math.max(50, Number.parseInt(process.env.POLYMARKET_MARKET_LIMIT ?? "500", 10) || 500);
const POLYMARKET_SIGNAL_THRESHOLD = Number.parseFloat(process.env.POLYMARKET_SIGNAL_THRESHOLD ?? "0.5") || 0.5;

function parseFiniteNumber(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseListField(value?: string | string[] | null): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseOutcomePrices(value?: string | string[] | null): number[] {
  return parseListField(value)
    .map((entry) => parseFiniteNumber(entry))
    .filter((entry) => entry >= 0 && entry <= 1);
}

function clampProbability(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

function parseDateMs(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMarket(raw: PolymarketGammaMarketResponse): PolymarketMarket {
  const outcomeLabels = parseListField(raw.outcomes);
  return {
    id: String(raw.id),
    conditionId: raw.conditionId,
    question: raw.question,
    slug: raw.slug,
    volume: parseFiniteNumber(raw.volume),
    liquidity: parseFiniteNumber(raw.liquidity),
    outcomePrices: parseOutcomePrices(raw.outcomePrices),
    outcomeLabels: outcomeLabels.length > 0 ? outcomeLabels : ["Yes", "No"],
    clobTokenIds: parseListField(raw.clobTokenIds),
    startDate: raw.startDate,
    endDate: raw.endDate,
    lastTradePrice: parseFiniteNumber(raw.lastTradePrice) || undefined,
    bestBid: parseFiniteNumber(raw.bestBid) || undefined,
    groupItemTitle: raw.groupItemTitle,
    bestAsk: parseFiniteNumber(raw.bestAsk) || undefined,
  };
}

function parseBookLevels(levels?: Array<{ price: string; size: string }>): PolymarketOrderBookLevel[] {
  return (levels ?? [])
    .map((level) => ({
      price: parseFiniteNumber(level.price),
      size: parseFiniteNumber(level.size),
    }))
    .filter((level) => level.price > 0 && level.size > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  async waitForSlot(): Promise<void> {
    while (true) {
      const now = Date.now();
      while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.windowMs) {
        this.timestamps.shift();
      }

      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }

      const waitMs = this.windowMs - (now - this.timestamps[0]) + 10;
      await sleep(waitMs);
    }
  }
}

const clobRateLimiter = new SlidingWindowRateLimiter(90, 60_000);

export async function getActiveMarkets(): Promise<PolymarketMarket[]> {
  const searchParams = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(POLYMARKET_MARKET_LIMIT),
  });
  const response = await fetch(`${POLYMARKET_GAMMA_URL}?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Polymarket Gamma API error: ${response.status}`);
  }

  const rawMarkets = (await response.json()) as PolymarketGammaMarketResponse[];
  const now = Date.now();
  return rawMarkets
    .filter((market) => market.active !== false && market.closed !== true && market.acceptingOrders !== false)
    .map(normalizeMarket)
    .filter((market) => {
      const closeMs = parseDateMs(market.endDate);
      if (closeMs && closeMs <= now) return false;
      const openMs = parseDateMs(market.startDate);
      if (openMs && openMs > now) return false;
      return market.question && market.outcomePrices.length >= 2 && market.clobTokenIds.length >= 1;
    })
    .sort((a, b) => b.volume - a.volume);
}

export async function getMarketOrderBook(tokenId: string): Promise<PolymarketOrderBook> {
  await clobRateLimiter.waitForSlot();

  const response = await fetch(`${POLYMARKET_HOST}/book?token_id=${encodeURIComponent(tokenId)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Polymarket CLOB book error: ${response.status}`);
  }

  const rawBook = (await response.json()) as PolymarketOrderBookResponse;
  const bids = parseBookLevels(rawBook.bids);
  const asks = parseBookLevels(rawBook.asks);
  const bestBid = bids.reduce<number | undefined>(
    (current, level) => (current == null || level.price > current ? level.price : current),
    undefined
  );
  const bestAsk = asks.reduce<number | undefined>(
    (current, level) => (current == null || level.price < current ? level.price : current),
    undefined
  );

  return {
    marketId: rawBook.market,
    tokenId: rawBook.asset_id,
    timestamp: rawBook.timestamp,
    bids,
    asks,
    bestBid,
    bestAsk,
    spread:
      bestBid != null && bestAsk != null && bestAsk >= bestBid
        ? Number((bestAsk - bestBid).toFixed(4))
        : undefined,
    lastTradePrice: parseFiniteNumber(rawBook.last_trade_price) || undefined,
  };
}

export async function detectSignalMovements(markets: PolymarketMarket[]): Promise<PolymarketSignalCandidate[]> {
  const now = Date.now();
  const signals: PolymarketSignalCandidate[] = [];

  for (const market of markets) {
    const currentProb = clampProbability((market.outcomePrices[0] ?? 0) * 100);
    const previousSnapshot = await getProbabilitySnapshot60sAgo("polymarket", market.id, now);

    await saveProbabilitySnapshot("polymarket", market.id, {
      probability: currentProb,
      question: market.question,
      volume: market.volume,
      capturedAt: now,
    });

    if (!previousSnapshot) continue;

    const delta = Number((currentProb - previousSnapshot.probability).toFixed(2));
    if (Math.abs(delta) < POLYMARKET_SIGNAL_THRESHOLD) continue;

    signals.push({
      marketId: market.id,
      tokenId: market.clobTokenIds[0],
      question: market.question,
      currentProb,
      previousProb: previousSnapshot.probability,
      delta,
      direction: delta >= 0 ? "up" : "down",
      volume: market.volume,
      timestamp: new Date(now).toISOString(),
      source: "polymarket",
      slug: market.slug,
    });
  }

  return signals.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export async function createDepositAddresses(address: string): Promise<PolymarketDepositResponse> {
  const response = await fetch(`${POLYMARKET_BRIDGE_URL}/deposit`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Polymarket bridge deposit error: ${response.status}`);
  }

  return (await response.json()) as PolymarketDepositResponse;
}
