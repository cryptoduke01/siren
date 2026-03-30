export interface PolymarketGammaMarketResponse {
  id: string;
  conditionId: string;
  question: string;
  slug?: string;
  volume?: string | number;
  liquidity?: string | number;
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  startDate?: string;
  endDate?: string;
  lastTradePrice?: string | number;
  bestBid?: string | number;
  bestAsk?: string | number;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
}

export interface PolymarketMarket {
  id: string;
  conditionId: string;
  question: string;
  slug?: string;
  volume: number;
  liquidity: number;
  outcomePrices: number[];
  clobTokenIds: string[];
  startDate?: string;
  endDate?: string;
  lastTradePrice?: number;
  bestBid?: number;
  bestAsk?: number;
}

export interface PolymarketOrderBookLevel {
  price: number;
  size: number;
}

export interface PolymarketOrderBookResponse {
  market?: string;
  asset_id: string;
  timestamp?: string;
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
  min_order_size?: string;
  tick_size?: string;
  neg_risk?: boolean;
  last_trade_price?: string;
}

export interface PolymarketOrderBook {
  marketId?: string;
  tokenId: string;
  timestamp?: string;
  bids: PolymarketOrderBookLevel[];
  asks: PolymarketOrderBookLevel[];
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
}

export interface PolymarketSignalCandidate {
  marketId: string;
  tokenId?: string;
  question: string;
  currentProb: number;
  previousProb: number;
  delta: number;
  direction: "up" | "down";
  volume: number;
  timestamp: string;
  source: "polymarket";
  slug?: string;
}

export interface PolymarketDepositAddressMap {
  evm?: string;
  svm?: string;
  tron?: string;
  btc?: string;
}

export interface PolymarketDepositResponse {
  address: PolymarketDepositAddressMap;
  note?: string;
}
