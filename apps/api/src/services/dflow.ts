/**
 * DFlow Quote API — prediction market order (quote + transaction).
 * Production: https://e.quote-api.dflow.net
 */

const SOL_MINT = "So11111111111111111111111111111111111111112";

function getConfig() {
  return {
    url: process.env.DFLOW_QUOTE_API_URL || "https://e.quote-api.dflow.net",
    key: process.env.DFLOW_API_KEY || "",
  };
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

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: `DFlow API error: ${res.status} (no JSON body)` };
  }

  if (!res.ok) {
    if (res.status === 429) {
      return { error: "DFlow is rate limited right now. Please retry in a few seconds." };
    }
    const msg =
      (data.error as string) ||
      (data.message as string) ||
      (data.detail as string) ||
      (typeof data.detail === "object" && data.detail !== null && "msg" in data.detail
        ? String((data.detail as { msg?: string }).msg)
        : null) ||
      `DFlow API error: ${res.status}`;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[DFlow] Order failed:", { status: res.status, body: data, outputMint: outputMint.slice(0, 8) });
    }
    return { error: String(msg) };
  }

  return {
    transaction: data.transaction as string,
    executionMode: data.executionMode as "sync" | "async" | undefined,
    lastValidBlockHeight: typeof data.lastValidBlockHeight === "number" ? data.lastValidBlockHeight : undefined,
    inAmount: typeof data.inAmount === "string" ? data.inAmount : undefined,
    outAmount: typeof data.outAmount === "string" ? data.outAmount : undefined,
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

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: `DFlow API error: ${res.status} (no JSON body)` };
  }

  if (!res.ok) {
    if (res.status === 429) {
      return { error: "DFlow order-status requests are rate limited right now. Please retry in a few seconds." };
    }
    const msg =
      (data.error as string) ||
      (data.message as string) ||
      (data.detail as string) ||
      `DFlow order status error: ${res.status}`;
    return { error: String(msg) };
  }

  return {
    status: data.status as DFlowOrderStatusResult["status"],
    inAmount: data.inAmount as string | undefined,
    outAmount: data.outAmount as string | undefined,
    fills: Array.isArray(data.fills) ? (data.fills as DFlowOrderStatusResult["fills"]) : undefined,
    reverts: Array.isArray(data.reverts) ? (data.reverts as DFlowOrderStatusResult["reverts"]) : undefined,
  };
}
