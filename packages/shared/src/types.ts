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

export interface MarketOutcome {
  label: string;
  probability: number;
  ticker?: string;
  subtitle?: string;
  market_url?: string;
  yes_mint?: string;
  no_mint?: string;
  yes_token_id?: string;
  no_token_id?: string;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  open_interest?: number;
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
  outcomes?: MarketOutcome[];
  grouped_event?: boolean;
  outcome_count?: number;
  selected_outcome_label?: string;
}

/** Optional SPL token shape for wallet / legacy payloads (not used for market-keyword surfacing). */
export interface SurfacedTokenFields {
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
export type LaunchpadId = "pump" | "bonk" | "moonshot" | "other";

export interface SurfacedToken extends SurfacedTokenFields {
  relevanceScore: number;
  matchType: "name" | "volume" | "ct";
  /** Launchpad detected from mint suffix (Pump.fun, Bonk.fun, etc.). */
  launchpad?: LaunchpadId;
  liquidityUsd?: number;
  fdvUsd?: number;
  holders?: number;
  bondingCurveStatus?: "bonded" | "bonding" | "unknown";
  rugcheckScore?: number;
  safe?: boolean;
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
  /** YES bid/ask from metadata when present (0–1 or string from API). */
  yesBid?: string;
  yesAsk?: string;
  /** Share count (same as balance; explicit for clients). */
  quantity?: number;
  /** Approximate mark in USD per share for this side (YES: prob/100, NO: (100-prob)/100). */
  currentPriceUsd?: number;
  /** Per-share mark in cents for UI/PnL convenience. */
  currentPrice?: number;
  /** Average entry in cents derived from Siren trade logs when available. */
  entryPrice?: number;
  /** Mark-to-market PnL derived from Siren trade logs when available. */
  pnlUsd?: number;
  pnlPct?: number;
  /** Mark-to-market USD: quantity * currentPriceUsd. */
  marketValueUsd?: number;
  /** Market close / resolution deadline in epoch ms when known. */
  closeTime?: number;
  /** Upstream market lifecycle status when provided by venue metadata. */
  marketStatus?: string;
  /** Human-readable outcome label for grouped / multi-outcome markets. */
  outcomeLabel?: string | null;
  /** When Siren first saw the buy-side history for this position. */
  openedAt?: string | null;
  /** When Siren last saw the close-side history for this position. */
  closedAt?: string | null;
  /** `open` for active exposure, `settled` for completed/ended rows surfaced in portfolio history. */
  status?: "open" | "settled";
  /** Optional marker for why the position moved into settled/history view. */
  settledReason?: "closed_position" | "market_closed" | "history_only" | null;
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
