const TORQUE_EVENT_NAMES = [
  "trade_attempt_logged",
  "trade_attempt_success",
  "trade_attempt_failed",
  "partial_fill_recorded",
] as const;

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
  const webhookUrl = process.env.TORQUE_CUSTOM_EVENTS_WEBHOOK_URL?.trim() || "";
  return {
    configured: Boolean(webhookUrl),
    relayMode: "custom_webhook" as const,
    webhookHost: safeHostname(webhookUrl),
    eventNames: [...TORQUE_EVENT_NAMES],
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
      "Custom event ingestion shape is still something Siren has to infer from the outside unless a concrete webhook contract is documented.",
      "Trading products need clearer examples for behavior-based rewards, not just volume-based incentives.",
    ],
    summary: webhookUrl
      ? "Siren can relay execution outcome events into Torque-compatible growth primitives."
      : "Set TORQUE_CUSTOM_EVENTS_WEBHOOK_URL to relay Siren execution events into Torque campaigns.",
  };
}

function getTorqueEventName(payload: LoggedTradeAttemptPayload): (typeof TORQUE_EVENT_NAMES)[number] {
  if (payload.metadata.partialSellFilled === true) return "partial_fill_recorded";
  if (payload.status === "success") return "trade_attempt_success";
  if (payload.status === "failed" || !!payload.error_message) return "trade_attempt_failed";
  return "trade_attempt_logged";
}

export async function emitTorqueTradeAttemptEvent(payload: LoggedTradeAttemptPayload): Promise<void> {
  const webhookUrl = process.env.TORQUE_CUSTOM_EVENTS_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const apiKey = process.env.TORQUE_API_KEY?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({
        source: "siren",
        event: getTorqueEventName(payload),
        timestamp: new Date().toISOString(),
        wallet: payload.wallet,
        properties: {
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
          ...payload.metadata,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
