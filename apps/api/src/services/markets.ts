import type { MarketWithVelocity } from "@siren/shared";
import { getActiveMarkets as getPolymarketMarkets } from "../lib/polymarket.js";

const DFLOW_METADATA_URL = process.env.DFLOW_METADATA_API_URL || "https://dev-prediction-markets-api.dflow.net";
const DFLOW_API_KEY = process.env.DFLOW_API_KEY || "";

interface DFlowAccountInfo {
  yesMint?: string;
  noMint?: string;
  isInitialized?: boolean;
}

interface DFlowMarketResponse {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle?: string;
  yesBid?: string;
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  volume: number;
  openInterest: number;
  status: string;
  closeDate?: string;
  endDate?: string;
  accounts?: Record<string, DFlowAccountInfo>;
}

interface DFlowEventsResponse {
  events?: Array<{
    ticker: string;
    seriesTicker?: string;
    title: string;
    closeDate?: string;
    endDate?: string;
    markets?: DFlowMarketResponse[];
  }>;
}

const dflowHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};
if (DFLOW_API_KEY) dflowHeaders["x-api-key"] = DFLOW_API_KEY;

async function fetchDFlowMarkets(): Promise<MarketWithVelocity[]> {
  const url = `${DFLOW_METADATA_URL}/api/v1/events?withNestedMarkets=true&status=active&limit=50`;
  const res = await fetch(url, { headers: dflowHeaders, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`DFlow API error: ${res.status}`);

  const json = (await res.json()) as DFlowEventsResponse;
  const events = json.events ?? [];
  const markets: MarketWithVelocity[] = [];

  for (const event of events) {
    const eventMarkets = event.markets ?? [];
    const seriesTicker = event.seriesTicker ?? event.ticker?.split("-").slice(0, -1).join("-") ?? "";
    for (const m of eventMarkets) {
      const yesBid = m.yesBid ? parseFloat(m.yesBid) : undefined;
      const yesAsk = m.yesAsk ? parseFloat(m.yesAsk) : undefined;
      const prob = yesBid ?? yesAsk ?? 50;

      const accountValues = m.accounts ? Object.values(m.accounts) : [];
      const firstAccount = accountValues.find((a) => a.yesMint && a.noMint);

      const closeDateRaw = m.closeDate ?? m.endDate ?? event.closeDate ?? event.endDate;
      let closeTime: number | undefined;
      if (closeDateRaw) {
        const ts = new Date(closeDateRaw).getTime();
        if (!isNaN(ts)) closeTime = ts;
      }

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
        ticker: m.ticker,
        event_ticker: m.eventTicker,
        series_ticker: seriesTicker,
        title: m.title,
        subtitle: m.subtitle,
        status: "open",
        yes_bid: yesBid,
        yes_ask: yesAsk,
        volume: m.volume,
        open_interest: m.openInterest,
        probability: prob,
        velocity_1h: 0,
        yes_mint: firstAccount?.yesMint,
        no_mint: firstAccount?.noMint,
        kalshi_url,
        close_time: closeTime,
        source: "kalshi",
        market_url: kalshi_url,
      });
    }
  }

  return markets;
}

async function fetchPolymarketMarkets(): Promise<MarketWithVelocity[]> {
  const polyMarkets = await getPolymarketMarkets();
  return polyMarkets.slice(0, 40).map((m) => {
    const prob = (m.outcomePrices[0] ?? 0.5) * 100;
    const endTs = m.endDate ? new Date(m.endDate).getTime() : undefined;
    const closeTime = endTs && !isNaN(endTs) ? endTs : undefined;
    const slug = m.slug ?? m.id;

    return {
      ticker: `POLY-${m.id}`,
      event_ticker: m.id,
      title: m.question,
      status: "open" as const,
      volume: Math.round(m.volume),
      open_interest: 0,
      probability: Math.min(100, Math.max(0, prob)),
      velocity_1h: 0,
      source: "polymarket",
      platform_id: m.id,
      market_url: `https://polymarket.com/event/${slug}`,
      market_slug: slug,
      close_time: closeTime,
      yes_token_id: m.clobTokenIds[0],
      no_token_id: m.clobTokenIds[1],
      condition_id: m.conditionId,
      liquidity: m.liquidity,
      yes_bid: m.bestBid,
      yes_ask: m.bestAsk,
    };
  });
}

/** Fetch markets from both DFlow (Kalshi) and Polymarket, merge and rank by volume. */
export async function getMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const [dflowResult, polyResult] = await Promise.allSettled([
    fetchDFlowMarkets(),
    fetchPolymarketMarkets(),
  ]);

  const dflow = dflowResult.status === "fulfilled" ? dflowResult.value : [];
  const poly = polyResult.status === "fulfilled" ? polyResult.value : [];

  if (dflowResult.status === "rejected") {
    console.error("[Siren] DFlow markets failed:", dflowResult.reason);
  }
  if (polyResult.status === "rejected") {
    console.error("[Siren] Polymarket markets failed:", polyResult.reason);
  }

  const merged = [...dflow, ...poly];

  return merged
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 50);
}
