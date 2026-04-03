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
    }
    return { error: String(msg) };
  }

  return {
    transaction: dataRecord.transaction as string,
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
