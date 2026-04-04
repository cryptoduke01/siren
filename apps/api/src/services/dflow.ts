/**
 * DFlow Quote API — prediction market order (quote + transaction).
 * Production: https://e.quote-api.dflow.net
 */

function getConfig() {
  return {
    url: process.env.DFLOW_QUOTE_API_URL || "https://e.quote-api.dflow.net",
    key: process.env.DFLOW_API_KEY || "",
  };
}

function formatDflowError(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatDflowError(item))
      .filter((item): item is string => !!item);
    return parts.length ? parts.join("; ") : null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const direct =
    formatDflowError(record.error) ||
    formatDflowError(record.message) ||
    formatDflowError(record.detail) ||
    formatDflowError(record.msg) ||
    formatDflowError(record.reason);
  if (direct) return direct;

  const fields = Object.entries(record)
    .map(([key, fieldValue]) => {
      const formatted = formatDflowError(fieldValue);
      return formatted ? `${key}: ${formatted}` : null;
    })
    .filter((item): item is string => !!item);
  return fields.length ? fields.join("; ") : null;
}

async function readDflowBody(res: Response): Promise<{ data: unknown; rawText: string }> {
  const rawText = await res.text();
  if (!rawText.trim()) return { data: null, rawText };
  try {
    return { data: JSON.parse(rawText) as unknown, rawText };
  } catch {
    return { data: null, rawText };
  }
}

export interface DFlowOrderParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  userPublicKey: string;
  slippageBps?: number;
  predictionMarketSlippageBps?: number;
}

export interface DFlowOrderResult {
  transaction?: string;
  error?: string;
  executionMode?: "sync" | "async";
  lastValidBlockHeight?: number;
  inAmount?: string;
  outAmount?: string;
}

export interface DFlowOrderStatusResult {
  status?: "pending" | "expired" | "failed" | "open" | "pendingClose" | "closed";
  inAmount?: string;
  outAmount?: string;
  fills?: Array<{
    inAmount?: string;
    inputMint?: string;
    outAmount?: string;
    outputMint?: string;
    signature?: string;
  }>;
  reverts?: Array<{
    amount?: string;
    mint?: string;
    signature?: string;
  }>;
  error?: string;
}

/** USDC — common settlement for Kalshi outcome sells. */
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** CASH — alternate DFlow settlement mint (see DFlow `route_not_found` / settlement docs). */
const DFLOW_CASH_SETTLEMENT_MINT = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";

function shouldRetryOutcomeSellWithCashSettlement(lastError: string): boolean {
  const e = lastError.toLowerCase();
  return (
    e.includes("route_not_found") ||
    e.includes("route not found") ||
    e.includes("no route") ||
    e.includes("no viable route") ||
    e.includes("could not find") ||
    e.includes("settlement")
  );
}

/**
 * Same as getDflowOrder, but when selling an outcome token for USDC and DFlow returns a route
 * error, retries once with the CASH settlement mint (per DFlow prediction-market trading docs).
 */
export async function getDflowOrderWithSettlementFallback(
  params: DFlowOrderParams & { retryCashSettlementOnRouteError?: boolean },
): Promise<DFlowOrderResult> {
  const { retryCashSettlementOnRouteError, ...rest } = params;
  const first = await getDflowOrder(rest);
  if (first.transaction) return first;
  if (
    retryCashSettlementOnRouteError &&
    rest.outputMint === SOLANA_USDC_MINT &&
    rest.inputMint !== SOLANA_USDC_MINT &&
    shouldRetryOutcomeSellWithCashSettlement(first.error || "")
  ) {
    const second = await getDflowOrder({
      ...rest,
      outputMint: DFLOW_CASH_SETTLEMENT_MINT,
    });
    if (second.transaction) return second;
    return {
      transaction: "",
      error:
        second.error ||
        first.error ||
        "No route to sell this position right now (liquidity or settlement). Try again shortly.",
    };
  }
  return first;
}

export async function getDflowOrder(params: DFlowOrderParams): Promise<DFlowOrderResult> {
  const { inputMint, outputMint, amount, userPublicKey, slippageBps = 200, predictionMarketSlippageBps = 500 } = params;
  const { url: baseUrl, key } = getConfig();

  if (!key) {
    return { error: "DFlow API key not configured. Add DFLOW_API_KEY to apps/api/.env and restart the API (pnpm dev:api)." };
  }

  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    userPublicKey,
    slippageBps: String(slippageBps),
    predictionMarketSlippageBps: String(predictionMarketSlippageBps),
  });

  const url = `${baseUrl}/order?${qs}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
  });

  const { data, rawText } = await readDflowBody(res);
  const dataRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  if (!res.ok) {
    if (res.status === 429) {
      return { error: "DFlow is rate limited right now. Please retry in a few seconds." };
    }
    const msg = formatDflowError(data) || rawText.trim() || `DFlow API error: ${res.status}`;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[DFlow] Order failed:", { status: res.status, body: data ?? rawText, outputMint: outputMint.slice(0, 8) });
    } else {
      console.warn(
        "[DFlow] Order failed:",
        JSON.stringify({
          status: res.status,
          err: String(msg).slice(0, 240),
          in: inputMint.slice(0, 12),
          out: outputMint.slice(0, 12),
        }),
      );
    }
    return { error: String(msg) };
  }

  const txRaw = dataRecord.transaction;
  const transaction = typeof txRaw === "string" ? txRaw.trim() : "";
  if (!transaction) {
    return {
      error:
        "DFlow returned no transaction. Check wallet verification for prediction trading, region eligibility, and that DFlow services are reachable.",
    };
  }

  return {
    transaction,
    executionMode: dataRecord.executionMode as "sync" | "async" | undefined,
    lastValidBlockHeight: typeof dataRecord.lastValidBlockHeight === "number" ? dataRecord.lastValidBlockHeight : undefined,
    inAmount: typeof dataRecord.inAmount === "string" ? dataRecord.inAmount : undefined,
    outAmount: typeof dataRecord.outAmount === "string" ? dataRecord.outAmount : undefined,
  };
}

export async function getDflowOrderStatus(signature: string, lastValidBlockHeight?: number | null): Promise<DFlowOrderStatusResult> {
  const { url: baseUrl, key } = getConfig();
  if (!key) {
    return { error: "DFlow API key not configured. Add DFLOW_API_KEY to apps/api/.env and restart the API (pnpm dev:api)." };
  }

  const qs = new URLSearchParams({ signature });
  if (typeof lastValidBlockHeight === "number" && Number.isFinite(lastValidBlockHeight)) {
    qs.set("lastValidBlockHeight", String(lastValidBlockHeight));
  }

  const res = await fetch(`${baseUrl}/order-status?${qs.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
  });

  const { data, rawText } = await readDflowBody(res);
  const dataRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  if (!res.ok) {
    if (res.status === 429) {
      return { error: "DFlow order-status requests are rate limited right now. Please retry in a few seconds." };
    }
    const msg = formatDflowError(data) || rawText.trim() || `DFlow order status error: ${res.status}`;
    return { error: String(msg) };
  }

  return {
    status: dataRecord.status as DFlowOrderStatusResult["status"],
    inAmount: dataRecord.inAmount as string | undefined,
    outAmount: dataRecord.outAmount as string | undefined,
    fills: Array.isArray(dataRecord.fills) ? (dataRecord.fills as DFlowOrderStatusResult["fills"]) : undefined,
    reverts: Array.isArray(dataRecord.reverts) ? (dataRecord.reverts as DFlowOrderStatusResult["reverts"]) : undefined,
  };
}
