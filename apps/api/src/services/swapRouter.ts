/**
 * Swap router: DFlow for prediction market tokens, Bags for Bags tokens, Jupiter fallback.
 * DFlow: Kalshi prediction market tokens only (geo-fenced).
 * Bags: Tokens launched on Bags (mint ends with "BAGS").
 * Jupiter: All SPL tokens, MEV-protected routing.
 */

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getDflowOrderWithSettlementFallback } from "./dflow.js";
import { getMarketsWithVelocity } from "./markets.js";
import { shouldBlockByCountry } from "../lib/geo-fence.js";
import { getBagsTradeQuote, createBagsSwapTransaction } from "./bags.js";

const JUPITER_BASE = "https://api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DFLOW_METADATA_URL = process.env.DFLOW_METADATA_API_URL || "https://dev-prediction-markets-api.dflow.net";

function isBagsMint(mint: string): boolean {
  return mint.endsWith("BAGS");
}

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

function isRouteNotFoundError(message?: string): boolean {
  const lower = (message || "").toLowerCase();
  return lower.includes("route_not_found") || lower.includes("route not found");
}

async function explainPredictionSellRouteFailure(inputMint: string): Promise<string | null> {
  try {
    const res = await fetch(`${DFLOW_METADATA_URL}/api/v1/market/by-mint/${encodeURIComponent(inputMint)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      market?: {
        yesBid?: string | null;
        noBid?: string | null;
        accounts?: Record<string, { yesMint?: string; noMint?: string }>;
      };
    };
    const market = payload?.market;
    if (!market?.accounts) return null;
    const accounts = Object.values(market.accounts);
    const matching = accounts.find((entry) => entry?.yesMint === inputMint || entry?.noMint === inputMint);
    if (!matching) return null;
    const sellingSide = matching.yesMint === inputMint ? "yes" : "no";
    const sideBid = sellingSide === "yes" ? market.yesBid : market.noBid;
    if (!sideBid || sideBid === "0" || sideBid === "0.0") {
      return `No ${sellingSide.toUpperCase()} bids are currently available for this market. Try again later or sell a smaller amount.`;
    }
    return "No executable route found for this exact size right now. Try selling a smaller amount.";
  } catch {
    return null;
  }
}

export type SwapProvider = "dflow" | "bags" | "jupiter";

export interface SwapOrderParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  userPublicKey: string;
  slippageBps?: number;
  tryDflowFirst?: boolean;
  countryCode?: string | null;
  forcePredictionMarket?: boolean;
}

export interface SwapOrderResult {
  provider: SwapProvider;
  transaction: string;
  error?: string;
  executionMode?: "sync" | "async";
  lastValidBlockHeight?: number;
  inAmount?: string;
  outAmount?: string;
}

export async function getSwapOrder(params: SwapOrderParams): Promise<SwapOrderResult> {
  const { inputMint, outputMint, amount, userPublicKey, slippageBps = 200, tryDflowFirst = true, countryCode, forcePredictionMarket = false } = params;

  const mints = await getMarketMints();
  const inputIsMarket = isMarketMint(inputMint, mints);
  const outputIsMarket = isMarketMint(outputMint, mints);
  const involvesPredictionMarket = forcePredictionMarket || inputIsMarket || outputIsMarket;
  const dflowBlocked = shouldBlockByCountry(countryCode);

  if (involvesPredictionMarket) {
    if (dflowBlocked) {
      return {
        provider: "dflow",
        transaction: "",
        error: "Prediction market trading is not available in your jurisdiction.",
      };
    }

    if (!tryDflowFirst) {
      return {
        provider: "dflow",
        transaction: "",
        error: "Prediction market routing requires DFlow.",
      };
    }

    const sellingOutcomeForUsdc =
      outputMint === SOLANA_USDC_MINT && inputMint !== SOLANA_USDC_MINT && inputMint !== SOL_MINT;

    const dflow = await getDflowOrderWithSettlementFallback({
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      slippageBps,
      predictionMarketSlippageBps: 500,
      retryCashSettlementOnRouteError: sellingOutcomeForUsdc,
    });
    if (dflow.transaction) {
      return {
        provider: "dflow",
        transaction: dflow.transaction,
        executionMode: dflow.executionMode,
        lastValidBlockHeight: dflow.lastValidBlockHeight,
        inAmount: dflow.inAmount,
        outAmount: dflow.outAmount,
      };
    }

    if (sellingOutcomeForUsdc && isRouteNotFoundError(dflow.error)) {
      const detailed = await explainPredictionSellRouteFailure(inputMint);
      return {
        provider: "dflow",
        transaction: "",
        error: detailed || "No executable route found for this exact size right now. Try selling a smaller amount.",
      };
    }

    return {
      provider: "dflow",
      transaction: "",
      error: dflow.error || "Prediction market routing is unavailable right now.",
    };
  }

  const inputIsBags = isBagsMint(inputMint);
  const outputIsBags = isBagsMint(outputMint);
  if ((inputIsBags || outputIsBags) && process.env.BAGS_API_KEY) {
    try {
      const quote = await getBagsTradeQuote({
        inputMint,
        outputMint,
        amount,
        slippageMode: "manual",
        slippageBps,
      });
      const tx = await createBagsSwapTransaction(quote, userPublicKey);
      if (tx) return { provider: "bags", transaction: tx };
    } catch {
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

  const platformFeeBps = parseInt(process.env.JUPITER_PLATFORM_FEE_BPS || "0", 10) || 0;
  const feeWallet = process.env.JUPITER_FEE_WALLET?.trim();
  const qs = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  if (platformFeeBps > 0 && platformFeeBps <= 1000) qs.set("platformFeeBps", String(platformFeeBps));
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

  let feeAccount: string | undefined;
  if (platformFeeBps > 0 && feeWallet) {
    try {
      const feeWalletPk = new PublicKey(feeWallet);
      feeAccount = getAssociatedTokenAddressSync(new PublicKey(outputMint), feeWalletPk).toBase58();
    } catch {
      /* skip feeAccount if derivation fails */
    }
  }
  const swapBody: Record<string, unknown> = {
    quoteResponse: quote,
    userPublicKey,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: true,
  };
  if (feeAccount) swapBody.feeAccount = feeAccount;
  const swapRes = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, Accept: "application/json" },
    body: JSON.stringify(swapBody),
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
