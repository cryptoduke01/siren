/**
 * Swap router: DFlow first for prediction market tokens (yes/no), Jupiter fallback.
 * DFlow: Kalshi prediction market tokens only (geo-fenced).
 * Jupiter: All SPL tokens, MEV-protected routing.
 */

import { getDflowOrder } from "./dflow.js";
import { getMarketsWithVelocity } from "./markets.js";
import { shouldBlockByCountry } from "../lib/geo-fence.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

let marketMintsCache: Set<string> = new Set();
let marketMintsCacheTs = 0;
const CACHE_TTL_MS = 60_000;

async function getMarketMints(): Promise<Set<string>> {
  if (Date.now() - marketMintsCacheTs < CACHE_TTL_MS && marketMintsCache.size > 0) {
    return marketMintsCache;
  }
  try {
    const markets = await getMarketsWithVelocity();
    const mints = new Set<string>();
    for (const m of markets) {
      if (m.yes_mint) mints.add(m.yes_mint);
      if (m.no_mint) mints.add(m.no_mint);
    }
    marketMintsCache = mints;
    marketMintsCacheTs = Date.now();
    return mints;
  } catch {
    return marketMintsCache;
  }
}

function isMarketMint(mint: string, mints: Set<string>): boolean {
  return mints.has(mint);
}

export type SwapProvider = "dflow" | "jupiter";

export interface SwapOrderParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  userPublicKey: string;
  slippageBps?: number;
  tryDflowFirst?: boolean;
}

export interface SwapOrderResult {
  provider: SwapProvider;
  transaction: string;
  error?: string;
}

export async function getSwapOrder(params: SwapOrderParams): Promise<SwapOrderResult> {
  const { inputMint, outputMint, amount, userPublicKey, slippageBps = 200, tryDflowFirst = true, countryCode } = params;

  const mints = await getMarketMints();
  const inputIsMarket = isMarketMint(inputMint, mints);
  const outputIsMarket = isMarketMint(outputMint, mints);
  const dflowBlocked = shouldBlockByCountry(countryCode);
  const canUseDflow = (inputIsMarket || outputIsMarket) && tryDflowFirst && !dflowBlocked;

  if (canUseDflow) {
    const dflow = await getDflowOrder({
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      slippageBps,
      predictionMarketSlippageBps: 500,
    });
    if (dflow.transaction) {
      return { provider: "dflow", transaction: dflow.transaction };
    }
  }

  const key = process.env.JUPITER_API_KEY;
  if (!key) {
    return {
      provider: "jupiter",
      transaction: "",
      error: "Jupiter API key not configured. Add JUPITER_API_KEY to apps/api/.env",
    };
  }

  const qs = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  const quoteRes = await fetch(`${JUPITER_BASE}/swap/v1/quote?${qs}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const quote = await quoteRes.json();
  if (!quoteRes.ok || quote.error) {
    return {
      provider: "jupiter",
      transaction: "",
      error: quote.error || quote.message || "Jupiter quote failed",
    };
  }

  const swapRes = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, Accept: "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    }),
  });
  const swapData = await swapRes.json();
  if (!swapRes.ok || swapData.error) {
    return {
      provider: "jupiter",
      transaction: "",
      error: swapData.error || swapData.message || "Jupiter swap build failed",
    };
  }

  const tx = swapData.swapTransaction;
  if (!tx) {
    return { provider: "jupiter", transaction: "", error: "No swap transaction returned" };
  }
  return { provider: "jupiter", transaction: tx };
}
