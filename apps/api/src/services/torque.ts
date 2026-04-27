const TORQUE_EVENT_NAME = "siren_trade_execution" as const;
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
  eventName: typeof TORQUE_EVENT_NAME;
  route: string;
  market: string;
  side: string;
  status: string;
  amount: number | null;
  reason: string;
  filledFraction: number | null;
  isPartialFill: boolean;
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
    eventNames: [TORQUE_EVENT_NAME],
    requiredSchemas: [
      {
        eventName: TORQUE_EVENT_NAME,
        name: "Siren Trade Execution",
        fields: [
          "route:string",
          "market:string",
          "side:string",
          "status:string",
          "reason:string",
          "amount:number",
          "filledFraction:number",
          "isPartialFill:boolean",
        ],
      },
    ],
    suggestedCampaigns: [
      {
        name: "weekly_clean_execution",
        objective: "Reward wallets that complete the most successful executions with fewer failures and partial fills.",
      },
      {
        name: "first_clean_close",
        objective: "Reward the first successful close routed through Siren without repeated failed attempts.",
      },
      {
        name: "partial_fill_rebate",
        objective: "Offer a small make-good for thin-liquidity fills where only part of the requested size executes.",
      },
    ],
    frictionLog: [
      "Torque custom-event schemas become query-ready only after the event is attached to a project and ingested at least once.",
      "Torque's typed event mapping rewards compact schemas, so Siren now uses one canonical execution event instead of several fragmented event names.",
      "Behavior-based execution rewards need more guided examples than pure volume campaigns, especially for trading products.",
    ],
    mcpQuickstart: {
      codexCommand: "codex mcp add torque --env TORQUE_API_TOKEN=your-token -- npx @torque-labs/mcp@latest",
      cursorConfigPath: "~/.cursor/mcp.json",
      toolSequence: [
        "check_auth_status",
        "authenticate",
        "list_projects",
        "set_active_project",
        "create_custom_event",
        "attach_custom_event",
        "create_api_key",
        "generate_incentive_query",
        "preview_incentive_query",
        "create_recurring_incentive",
      ],
    },
    campaignBlueprints: [
      {
        name: "Weekly Clean Execution Leaderboard",
        type: "leaderboard",
        interval: "WEEKLY",
        eventName: TORQUE_EVENT_NAME,
        valueExpression: "COUNT(*)",
        filters: ["status = 'success'"],
        customFormula: "RANK == 1 ? 300 : RANK == 2 ? 200 : RANK == 3 ? 100 : RANK <= 10 ? 50 : 0",
      },
      {
        name: "Partial Fill Rebate",
        type: "rebate",
        interval: "WEEKLY",
        eventName: TORQUE_EVENT_NAME,
        valueExpression: "SUM(amount)",
        filters: ["isPartialFill = true"],
        rebatePercentage: 5,
      },
    ],
    summary: apiKey
      ? "Siren can relay one canonical execution event into Torque and is ready for custom-event incentives once the project schema is attached."
      : "Set TORQUE_API_KEY to relay Siren execution events into Torque's custom-event ingestion pipeline.",
  };
}

function buildReasonLabel(payload: LoggedTradeAttemptPayload): string {
  if (payload.metadata.partialSellFilled === true) return "partial_fill";
  if (payload.status === "failed" || payload.error_message) return buildFailureReason(payload.error_message);
  if (payload.status === "success") return "filled";
  return "attempted";
}

export function previewTorqueTradeAttemptEvent(payload: LoggedTradeAttemptPayload): TorqueEmissionPreview {
  return {
    eventName: TORQUE_EVENT_NAME,
    route: buildRouteLabel(payload),
    market: payload.market ?? "unknown",
    side: payload.side ?? "unknown",
    status: payload.status,
    amount: parseNumericValue(payload.amount),
    reason: buildReasonLabel(payload),
    filledFraction: parseNumericValue(payload.metadata.filledFraction as string | number | null | undefined),
    isPartialFill: payload.metadata.partialSellFilled === true,
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
          status: event.status,
          reason: event.reason,
          amount: event.amount,
          filledFraction: event.filledFraction ?? undefined,
          isPartialFill: event.isPartialFill,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
