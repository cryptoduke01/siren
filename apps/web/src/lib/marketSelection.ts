import type { MarketWithVelocity, SignalSource } from "@siren/shared";
import type { SelectedMarket } from "@/store/useSirenStore";

const MARKET_KEYWORDS = [
  "trump",
  "fed",
  "rates",
  "cpi",
  "inflation",
  "sec",
  "bitcoin",
  "btc",
  "election",
  "world",
  "cup",
  "georgia",
  "purdue",
  "uae",
  "icc",
  "t20",
  "sol",
  "eth",
  "jpow",
  "pepe",
  "bonk",
];

const STOP_WORDS = new Set([
  "will",
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "way",
  "who",
  "any",
  "did",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "from",
  "than",
  "that",
  "this",
  "with",
  "what",
  "when",
  "where",
  "which",
]);

export function extractMarketKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const fromKnown = MARKET_KEYWORDS.filter((keyword) => lower.includes(keyword)).slice(0, 2);
  const words = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  const seen = new Set(fromKnown);
  const out = [...fromKnown];

  for (const word of words) {
    if (!seen.has(word) && out.length < 4) {
      seen.add(word);
      out.push(word);
    }
  }

  return out;
}

export function toSelectedMarket(market: MarketWithVelocity): SelectedMarket {
  return {
    source: (market.source as SignalSource) ?? "kalshi",
    ticker: market.ticker,
    platform_id: market.platform_id,
    market_url: market.market_url ?? market.kalshi_url,
    title: market.title,
    probability: market.probability,
    velocity_1h: market.velocity_1h,
    volume: market.volume,
    volume_24h: market.volume_24h,
    liquidity: market.liquidity,
    open_interest: market.open_interest,
    close_time: market.close_time,
    open_time: market.open_time,
    event_ticker: market.event_ticker,
    series_ticker: market.series_ticker,
    subtitle: market.subtitle,
    keywords: extractMarketKeywords(market.title),
    yes_mint: market.yes_mint,
    no_mint: market.no_mint,
    yes_token_id: market.yes_token_id,
    no_token_id: market.no_token_id,
    condition_id: market.condition_id,
    market_slug: market.market_slug,
    kalshi_url: market.kalshi_url,
    outcomes: market.outcomes,
    grouped_event: market.grouped_event,
    outcome_count: market.outcome_count,
    selected_outcome_label: market.selected_outcome_label,
  };
}
