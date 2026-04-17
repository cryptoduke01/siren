const TORQUE_EVENT_NAMES = [
  "trade_attempt_logged",
  "trade_attempt_success",
  "trade_attempt_failed",
  "partial_fill_recorded",
] as const;
const TORQUE_INGEST_URL = "https://ingest.torque.so/events";

type LoggedTradeAttemptPayload = {
  wallet: string | null;
  venue: string;
  mode: string;
  market: string | null;
  side: string | null;
  input_asset: string | null;
  output_asset: string | null;
  amount: string | null;
  status: string;
  tx_signature: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

function safeHostname(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function getTorqueRelayReadiness() {
  const apiKey = process.env.TORQUE_API_KEY?.trim() || "";
  return {
    configured: Boolean(apiKey),
    relayMode: "torque_ingest" as const,
    ingestHost: safeHostname(TORQUE_INGEST_URL),
    eventNames: [...TORQUE_EVENT_NAMES],
    requiredSchemas: [
      {
        eventName: "trade_attempt_logged",
        name: "Trade Attempt Logged",
        fields: ["venue", "mode", "market", "side", "inputAsset", "outputAsset", "amount", "status"],
      },
      {
        eventName: "trade_attempt_success",
        name: "Trade Attempt Success",
        fields: ["venue", "mode", "market", "side", "amount", "status", "txSignature"],
      },
      {
        eventName: "trade_attempt_failed",
        name: "Trade Attempt Failed",
        fields: ["venue", "mode", "market", "side", "amount", "status", "errorMessage"],
      },
      {
        eventName: "partial_fill_recorded",
        name: "Partial Fill Recorded",
        fields: ["venue", "mode", "market", "side", "amount", "status", "filledFraction"],
      },
    ],
    suggestedCampaigns: [
      {
        name: "first_clean_close",
        objective: "Reward users who complete their first successful close without repeated failed attempts.",
      },
      {
        name: "resolve_before_expiry",
        objective: "Nudge traders to reduce exposure before thin end-of-resolution liquidity windows.",
      },
      {
        name: "execution_leaderboard",
        objective: "Rank traders by successful execution quality instead of raw size alone.",
      },
    ],
    frictionLog: [
      "Event schemas must be created before ingestion becomes query-ready, so there is still a dashboard/setup dependency before incentives can be built.",
      "Trading products need clearer examples for behavior-based rewards, not just volume-based incentives.",
    ],
    summary: apiKey
      ? "Siren can relay execution outcome events directly into Torque's ingestion pipeline."
      : "Set TORQUE_API_KEY to relay Siren execution events into Torque custom events.",
  };
}

function getTorqueEventName(payload: LoggedTradeAttemptPayload): (typeof TORQUE_EVENT_NAMES)[number] {
  if (payload.metadata.partialSellFilled === true) return "partial_fill_recorded";
  if (payload.status === "success") return "trade_attempt_success";
  if (payload.status === "failed" || !!payload.error_message) return "trade_attempt_failed";
  return "trade_attempt_logged";
}

export async function emitTorqueTradeAttemptEvent(payload: LoggedTradeAttemptPayload): Promise<void> {
  const apiKey = process.env.TORQUE_API_KEY?.trim();
  if (!apiKey || !payload.wallet) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    await fetch(TORQUE_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        userPubkey: payload.wallet,
        timestamp: Date.now(),
        eventName: getTorqueEventName(payload),
        data: {
          venue: payload.venue,
          mode: payload.mode,
          market: payload.market,
          side: payload.side,
          inputAsset: payload.input_asset,
          outputAsset: payload.output_asset,
          amount: payload.amount,
          status: payload.status,
          txSignature: payload.tx_signature,
          errorMessage: payload.error_message,
          filledFraction: payload.metadata.filledFraction ?? null,
          ...payload.metadata,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
