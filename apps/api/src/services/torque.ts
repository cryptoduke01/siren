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

export type TorqueEmissionPreview = {
  eventName: (typeof TORQUE_EVENT_NAMES)[number];
  route: string;
  market: string;
  side: string;
  status: string;
  amount: number | null;
  txSignature: string | null;
  failureReason: string | null;
  filledFraction: number | null;
};

function parseNumericValue(value?: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildRouteLabel(payload: LoggedTradeAttemptPayload): string {
  return [payload.venue, payload.mode].filter(Boolean).join(":") || "unknown";
}

function buildAssetPair(payload: LoggedTradeAttemptPayload): string {
  const input = payload.input_asset?.trim();
  const output = payload.output_asset?.trim();
  if (input && output) return `${input}->${output}`;
  return input || output || "unknown";
}

function buildFailureReason(message?: string | null): string {
  const lower = message?.toLowerCase().trim() ?? "";
  if (!lower) return "unknown";
  if (lower.includes("route")) return "no_route";
  if (lower.includes("insufficient")) return "insufficient_balance";
  if (lower.includes("verify") || lower.includes("proof") || lower.includes("jurisdiction")) return "verification";
  if (lower.includes("slippage") || lower.includes("price")) return "price_move";
  if (lower.includes("thin") || lower.includes("depth") || lower.includes("partial")) return "thin_liquidity";
  return "other";
}

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
        fields: ["route", "market", "side", "assetPair", "status", "amount:number"],
      },
      {
        eventName: "trade_attempt_success",
        name: "Trade Attempt Success",
        fields: ["route", "market", "side", "status", "txSignature", "amount:number"],
      },
      {
        eventName: "trade_attempt_failed",
        name: "Trade Attempt Failed",
        fields: ["route", "market", "side", "status", "failureReason", "amount:number"],
      },
      {
        eventName: "partial_fill_recorded",
        name: "Partial Fill Recorded",
        fields: ["route", "market", "side", "status", "amount:number", "filledFraction:number"],
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

export function previewTorqueTradeAttemptEvent(payload: LoggedTradeAttemptPayload): TorqueEmissionPreview {
  const eventName = getTorqueEventName(payload);
  return {
    eventName,
    route: buildRouteLabel(payload),
    market: payload.market ?? "unknown",
    side: payload.side ?? "unknown",
    status: payload.status,
    amount: parseNumericValue(payload.amount),
    txSignature: payload.tx_signature ?? null,
    failureReason: eventName === "trade_attempt_failed" ? buildFailureReason(payload.error_message) : null,
    filledFraction: parseNumericValue(payload.metadata.filledFraction as string | number | null | undefined),
  };
}

export async function emitTorqueTradeAttemptEvent(payload: LoggedTradeAttemptPayload): Promise<void> {
  const apiKey = process.env.TORQUE_API_KEY?.trim();
  if (!apiKey || !payload.wallet) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const event = previewTorqueTradeAttemptEvent(payload);
    await fetch(TORQUE_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        userPubkey: payload.wallet,
        timestamp: Date.now(),
        eventName: event.eventName,
        data: {
          route: event.route,
          market: event.market,
          side: event.side,
          assetPair: buildAssetPair(payload),
          amount: event.amount,
          status: event.status,
          txSignature: event.txSignature ?? undefined,
          failureReason: event.failureReason ?? undefined,
          filledFraction: event.filledFraction ?? undefined,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
