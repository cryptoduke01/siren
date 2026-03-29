import type { PredictionSignal } from "@siren/shared";
import { detectSignalMovements, getActiveMarkets, getMarketOrderBook } from "../lib/polymarket.js";
import type { PolymarketMarket } from "../types/polymarket.js";
import { getMatchedTokensForQuestion } from "./signalMatcher.js";

function priceToPercent(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Number((value * 100).toFixed(2));
}

function timestampToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return undefined;
  return new Date(asNumber).toISOString();
}

export async function pollPolymarketMarkets(): Promise<PredictionSignal[]> {
  const markets = await getActiveMarkets();
  const signals = await detectSignalMovements(markets);
  const marketById = new Map<string, PolymarketMarket>(markets.map((market) => [market.id, market]));
  const topSignals = signals.slice(0, 8);

  return Promise.all(
    topSignals.map(async (signal) => {
      const market = marketById.get(signal.marketId);
      const book =
        market?.clobTokenIds[0]
          ? await getMarketOrderBook(market.clobTokenIds[0]).catch((error) => {
              console.warn(
                "[polymarket] order book lookup failed:",
                error instanceof Error ? error.message : String(error)
              );
              return null;
            })
          : null;

      return {
        id: `polymarket:${signal.marketId}:${Date.parse(signal.timestamp)}`,
        marketId: signal.marketId,
        source: "polymarket" as const,
        question: signal.question,
        currentProb: signal.currentProb,
        previousProb: signal.previousProb,
        delta: signal.delta,
        direction: signal.direction,
        volume: signal.volume,
        timestamp: signal.timestamp,
        matchedTokens: await getMatchedTokensForQuestion(signal.question),
        marketUrl: signal.slug ? `https://polymarket.com/event/${signal.slug}` : undefined,
        book: book
          ? {
              tokenId: book.tokenId,
              bestBid: priceToPercent(book.bestBid),
              bestAsk: priceToPercent(book.bestAsk),
              spread: priceToPercent(book.spread),
              lastTradePrice: priceToPercent(book.lastTradePrice),
              updatedAt: timestampToIso(book.timestamp),
            }
          : undefined,
      };
    })
  );
}
