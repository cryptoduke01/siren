import type { FastifyBaseLogger } from "fastify";
import { pollKalshiMarkets } from "./kalshiSignals.js";
import { pollPolymarketMarkets } from "./polymarketSignals.js";
import {
  getSignalFeedSnapshot,
  markSignalSourceFailed,
  markSignalSourceHealthy,
  publishSignals,
} from "./signalState.js";
import { broadcastSignalSnapshot } from "../ws.js";

let started = false;
const pollInFlight: Record<"kalshi" | "polymarket", boolean> = {
  kalshi: false,
  polymarket: false,
};

async function runSourcePoll(
  source: "kalshi" | "polymarket",
  poll: () => Promise<Awaited<ReturnType<typeof pollKalshiMarkets>>>,
  logger: FastifyBaseLogger
): Promise<void> {
  if (pollInFlight[source]) {
    logger.debug({ source }, `${source} poll skipped because the previous cycle is still running`);
    return;
  }

  pollInFlight[source] = true;
  try {
    const signals = await poll();
    await markSignalSourceHealthy(source);

    const snapshot = signals.length > 0 ? await publishSignals(signals) : await getSignalFeedSnapshot();
    broadcastSignalSnapshot(snapshot);

    if (signals.length > 0) {
      logger.info(
        { source, count: signals.length },
        `${source} signal poll completed with new signals`
      );
    }
  } catch (error) {
    logger.error(
      { err: error, source },
      `${source} signal poll failed`
    );
    const snapshot = await markSignalSourceFailed(source, error);
    broadcastSignalSnapshot(snapshot);
  } finally {
    pollInFlight[source] = false;
  }
}

export function startSignalPolling(logger: FastifyBaseLogger): void {
  if (started) return;
  started = true;

  void runSourcePoll("kalshi", pollKalshiMarkets, logger);
  void runSourcePoll("polymarket", pollPolymarketMarkets, logger);

  setInterval(() => {
    void runSourcePoll("kalshi", pollKalshiMarkets, logger);
  }, 30_000);

  setInterval(() => {
    void runSourcePoll("polymarket", pollPolymarketMarkets, logger);
  }, 30_000);

  logger.info("Signal polling started for Kalshi and Polymarket");
}
