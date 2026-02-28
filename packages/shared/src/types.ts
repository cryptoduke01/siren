export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: "open" | "closed" | "settled" | "unopened";
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume: number;
  open_interest: number;
  close_time?: number;
  open_time?: number;
}

export interface MarketWithVelocity extends KalshiMarket {
  velocity_1h: number;
  probability: number;
  yes_mint?: string;
  no_mint?: string;
  series_ticker?: string;
  kalshi_url?: string;
}

export interface BagsToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  volume24h?: number;
  ctMentions?: number;
  score?: number;
  launchedAt?: number;
}

export interface SurfacedToken extends BagsToken {
  relevanceScore: number;
  matchType: "name" | "volume" | "ct";
}

export interface DFlowMarket {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle?: string;
  status: string;
  yesBid?: string;
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  volume: number;
  openInterest: number;
  accounts: Record<string, { yesMint: string; noMint: string; isInitialized: boolean }>;
}
