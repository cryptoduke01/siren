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

  return { transaction: data.transaction as string };
}
