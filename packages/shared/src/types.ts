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
  volume_24h?: number;
  liquidity?: number;
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

export interface MarketTradeActivity {
  ticker: string;
  recent_trades_1h?: number;
  recent_trades_24h: number;
  last_trade_at?: string;
}

export interface BagsToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  volume24h?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  holders?: number;
  bondingCurveStatus?: "bonded" | "bonding" | "unknown";
  rugcheckScore?: number;
  safe?: boolean;
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

export interface SignalOrderBookSnapshot {
  tokenId?: string;
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
  book?: SignalOrderBookSnapshot;
}

export interface SignalSourceStatus {
  source: SignalSource;
  connected: boolean;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
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
