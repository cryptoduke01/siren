import type { MarketWithVelocity } from "@siren/shared";

const DFLOW_METADATA_URL = process.env.DFLOW_METADATA_API_URL || "https://dev-prediction-markets-api.dflow.net";
const DFLOW_API_KEY = process.env.DFLOW_API_KEY || "";

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
}

interface DFlowEventsResponse {
  events?: Array<{
    ticker: string;
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
    for (const m of eventMarkets) {
      const yesBid = m.yesBid ? parseFloat(m.yesBid) : undefined;
      const yesAsk = m.yesAsk ? parseFloat(m.yesAsk) : undefined;
      const prob = yesBid ?? yesAsk ?? 50;
      const velocity_1h = Math.random() * 8 - 4;

      markets.push({
        ticker: m.ticker,
        event_ticker: m.eventTicker,
        title: m.title,
        subtitle: m.subtitle,
        status: "open",
        yes_bid: yesBid,
        yes_ask: yesAsk,
        volume: m.volume,
        open_interest: m.openInterest,
        probability: prob,
        velocity_1h,
      });
    }
  }

  return markets.sort((a, b) => Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h)).slice(0, 20);
}
