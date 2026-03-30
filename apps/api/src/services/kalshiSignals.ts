import type { PredictionSignal } from "@siren/shared";
import { getMarketsWithVelocity } from "./markets.js";
import { getMatchedTokensForQuestion } from "./signalMatcher.js";
import { getProbabilitySnapshot60sAgo, saveProbabilitySnapshot } from "./signalState.js";

const KALSHI_SIGNAL_THRESHOLD = 3;

function clampProbability(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

export async function pollKalshiMarkets(): Promise<PredictionSignal[]> {
  const markets = await getMarketsWithVelocity();
  const now = Date.now();
  const candidates = [];

  for (const market of markets) {
    const currentProb = clampProbability(market.probability);
    const previousSnapshot = await getProbabilitySnapshot60sAgo("kalshi", market.ticker, now);

    await saveProbabilitySnapshot("kalshi", market.ticker, {
      probability: currentProb,
      question: market.title,
      volume: market.volume,
      capturedAt: now,
    });

    if (!previousSnapshot) continue;

    const delta = Number((currentProb - previousSnapshot.probability).toFixed(2));
    if (Math.abs(delta) < KALSHI_SIGNAL_THRESHOLD) continue;

    candidates.push({
      market,
      currentProb,
      previousProb: previousSnapshot.probability,
      delta,
      timestamp: new Date(now).toISOString(),
    });
  }

  const topCandidates = candidates.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8);

  return Promise.all(
    topCandidates.map(async ({ market, currentProb, previousProb, delta, timestamp }) => ({
      id: `kalshi:${market.ticker}`,
      marketId: market.ticker,
      source: "kalshi" as const,
      question: market.title,
      currentProb,
      previousProb,
      delta,
      direction: delta >= 0 ? "up" : "down",
      volume: market.volume,
      timestamp,
      matchedTokens: await getMatchedTokensForQuestion(market.title),
      marketUrl: market.kalshi_url,
    }))
  );
}
