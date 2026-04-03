import type { MarketWithVelocity } from "@siren/shared";

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
  accounts?: Record<string, DFlowAccountInfo>;
}

interface DFlowEventsResponse {
  events?: Array<{
    ticker: string;
    seriesTicker?: string;
    title: string;
    markets?: DFlowMarketResponse[];
  }>;
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (DFLOW_API_KEY) headers["x-api-key"] = DFLOW_API_KEY;

/** Fetch markets from DFlow Metadata API and compute velocity (mock for now) */
export async function getMarketsWithVelocity(): Promise<MarketWithVelocity[]> {
  const url = `${DFLOW_METADATA_URL}/api/v1/events?withNestedMarkets=true&status=active&limit=50`;
  const res = await fetch(url, { headers });
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
      const velocity_1h = Math.random() * 8 - 4;

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
        velocity_1h,
        yes_mint,
        no_mint,
        kalshi_url,
      });
    }
  }

  return markets.sort((a, b) => Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h)).slice(0, 20);
}
