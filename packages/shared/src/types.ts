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
  /** Mixed Kalshi / Polymarket unified feed (optional). */
  source?: string;
  platform_id?: string;
  market_url?: string;
  volume_24h?: number;
  liquidity?: number;
  yes_token_id?: string;
  no_token_id?: string;
  condition_id?: string;
  market_slug?: string;
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
  riskScore?: number;
  riskLabel?: "low" | "moderate" | "high" | "critical";
  riskReasons?: string[];
  riskBlocked?: boolean;
}

/** Launchpad identifier (mint suffix). */
export type LaunchpadId = "bags" | "pump" | "bonk" | "moonshot" | "other";

export interface SurfacedToken extends BagsToken {
  relevanceScore: number;
  matchType: "name" | "volume" | "ct";
  /** Launchpad detected from mint (Bags, Pump.fun, Bonk.fun, etc.). */
  launchpad?: LaunchpadId;
}

export type SignalSource = "kalshi" | "polymarket";

export interface SignalSourceStatus {
  source: SignalSource;
  connected: boolean;
  lastFailureAt?: string;
  lastError?: string;
}

export interface PolymarketBookSnapshot {
  tokenId: string;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  updatedAt?: string;
}

export interface PredictionSignal {
  id: string;
  marketId: string;
  source: SignalSource;
  question: string;
  currentProb: number;
  previousProb: number;
  delta: number;
  direction: "up" | "down";
  volume: number;
  timestamp: string;
  matchedTokens: SurfacedToken[];
  marketUrl?: string;
  book?: PolymarketBookSnapshot;
}

export interface SignalFeedSnapshot {
  signals: PredictionSignal[];
  status: SignalSourceStatus[];
  updatedAt: string;
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

/**
 * One Kalshi outcome position from DFlow Metadata (`filter_outcome_mints` + `markets/batch`).
 * Used by GET `/api/dflow/positions`.
 */
export interface DflowPositionRow {
  mint: string;
  balance: number;
  decimals: number;
  side: "yes" | "no";
  ticker: string;
  title: string;
  eventTicker?: string;
  seriesTicker?: string;
  kalshi_url?: string;
  /** Kalshi-implied YES probability (0–100) when bid/ask available */
  probability?: number;
  verified: true;
}

/** One fill line for Kalshi-style market activity (optional rows in `recentTrades`). */
export interface MarketTradeFill {
  side: "yes" | "no";
  priceCents?: number;
  count?: number;
  ts?: string;
}

/**
 * Response shape for `GET /api/markets/:ticker/activity` (Kalshi trade activity summary).
 * Fields are optional where the API may omit them during rollout.
 */
export interface MarketTradeActivity {
  ticker: string;
  tradeCount24h?: number;
  tradeCount1h?: number;
  lastTradeAt?: string | null;
  volumeUsd24h?: number;
  recentTrades?: MarketTradeFill[];
}
