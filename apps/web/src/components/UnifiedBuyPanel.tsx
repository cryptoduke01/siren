"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Loader2, ExternalLink } from "lucide-react";
import { useFundWallet as useEvmFundWallet } from "@privy-io/react-auth";
import { useSirenStore } from "@/store/useSirenStore";
import { useResultModalStore } from "@/store/useResultModalStore";
import { useMarketActivity } from "@/hooks/useMarketActivity";
import { useGoldRushWalletIntelligence } from "@/hooks/useGoldRushWalletIntelligence";
import { hapticLight } from "@/lib/haptics";
import {
  buildProofDeepLink,
  buildProofMessage,
  buildProofRedirectUri,
  encodeProofSignature,
  DFLOW_PROOF_PORTAL_URL,
} from "@/lib/dflowProof";
import { buildPolymarketFundingConfig } from "@/lib/privyFunding";
import { formatProfileName, readProfileName } from "@/lib/profilePrefs";
import { getPositionEntry } from "@/lib/positionEntryStorage";
import { fetchSolPriceUsd } from "@/lib/pricing";
import { API_URL } from "@/lib/apiUrl";
import { appendWalletAuthQuery, getWalletAuthHeaders } from "@/lib/requestAuth";
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LAMPORTS_PER_SOL = 1e9;
const POLYMARKET_HOST = "https://clob.polymarket.com";
const POLYGON_CHAIN_ID = 137;

function formatCompactNumber(value?: number, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatUsd(value?: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatTokenAmount(value?: number | null, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatAddressShort(address?: string | null): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isWalletVerificationError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("wallet must be verified") ||
    lower.includes("unverified_wallet_not_allowed") ||
    lower.includes("dflow.net/proof") ||
    lower.includes("proof verification") ||
    lower.includes("verify this wallet once on dflow")
  );
}

function getFriendlyTradeError(message: string, fallback: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("insufficient funds for fee") ||
    lower.includes("forrent") ||
    lower.includes("for rent") ||
    lower.includes("lamports") ||
    lower.includes("attempt to debit an account")
  ) {
    return "Not enough SOL to pay network fees. Add a small SOL balance, then try again.";
  }
  if (lower.includes("user rejected") || lower.includes("rejected the request") || lower.includes("4001")) {
    return "Wallet signature was canceled.";
  }
  if (lower.includes("not tradable")) {
    return "This market is not routable right now. Refresh and try again in a moment.";
  }
  if (lower.includes("route not found")) {
    return "No executable route found for this size right now. Try a smaller sell amount.";
  }
  if (lower.includes("validation error") || lower.includes("400")) {
    return "We could not get a live quote for this order right now. Please try again.";
  }
  if (message.includes("0x1771") || lower.includes("slippage")) {
    return "Price moved. Try a smaller amount.";
  }
  if (lower.includes("simulation failed") || lower.includes("custom program error")) {
    return "Transaction simulation failed. Try a smaller amount or higher slippage.";
  }
  if (lower.includes("insufficient")) {
    return "Insufficient balance for this trade.";
  }
  if (isWalletVerificationError(message) || lower.includes("proof")) {
    return "Verify this wallet once on DFlow before you trade this market.";
  }
  if (lower.includes("rate limited") || lower.includes("429")) {
    return "Routing is being rate limited upstream right now. Wait a few seconds and try again.";
  }
  if (lower.includes("jurisdiction")) {
    return "Prediction market trading is not available in your jurisdiction right now. Use the Kalshi link instead.";
  }
  return fallback;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
    const maybeReason = (error as { reason?: unknown }).reason;
    if (typeof maybeReason === "string" && maybeReason) return maybeReason;
  }
  return "Trade failed";
}

function logTradeFailure(context: Record<string, unknown>) {
  console.warn("[siren-trade-failure]", context);
  void fetch(`${API_URL}/api/trade-errors/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({
      ...context,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // Ignore logging transport failures to avoid masking the user-facing trade error.
  });
}

type DflowAsyncStatus = {
  status?: "pending" | "expired" | "failed" | "open" | "pendingClose" | "closed";
  error?: string;
};

async function waitForDflowSettlement(signature: string, lastValidBlockHeight?: number): Promise<DflowAsyncStatus> {
  let lastStatus: DflowAsyncStatus = {};
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt === 0 ? 800 : 1500);
    const qs = new URLSearchParams({ signature });
    if (typeof lastValidBlockHeight === "number" && Number.isFinite(lastValidBlockHeight)) {
      qs.set("lastValidBlockHeight", String(lastValidBlockHeight));
    }
    const res = await fetch(`${API_URL}/api/dflow/order-status?${qs.toString()}`, { credentials: "omit" });
    const data = (await res.json()) as DflowAsyncStatus;
    if (!res.ok) {
      throw new Error(data.error || "Unable to confirm DFlow order status.");
    }
    lastStatus = data;
    if (data.status === "closed" || data.status === "failed" || data.status === "expired") {
      return data;
    }
  }
  return lastStatus;
}

function parseUnitsToBigInt(amountStr: string, decimals: number): bigint {
  const raw = amountStr.trim();
  if (!raw) return BigInt(0);
  const negative = raw.startsWith("-");
  const s = negative ? raw.slice(1) : raw;

  const [wholePart, fracPartRaw = ""] = s.split(".");
  const whole = wholePart ? BigInt(wholePart) : BigInt(0);
  const fracDigits = fracPartRaw.replace(/[^0-9]/g, "");
  const fracTrunc = fracDigits.slice(0, decimals);
  const fracPadded = fracTrunc.padEnd(decimals, "0");
  const frac = fracPadded ? BigInt(fracPadded) : BigInt(0);

  const scale = BigInt(10) ** BigInt(decimals);
  const baseUnits = whole * scale + frac;
  return negative ? -baseUnits : baseUnits;
}

export function UnifiedBuyPanel() {
  const { selectedMarket, selectedToken, buyPanelOpen, buyPanelMode, setBuyPanelOpen, setSelectedToken, openForSell } =
    useSirenStore();
  const { connected, publicKey, evmAddress, signTransaction, signMessage, getEvmProvider, switchEvmChain } = useSirenWallet();
  const { connection } = useConnection();
  const { fundWallet: fundEvmWallet } = useEvmFundWallet();
  const showResultModal = useResultModalStore((s) => s.show);
  const hideResultModal = useResultModalStore((s) => s.hide);
  const resultModalOpen = useResultModalStore((s) => s.payload != null);
  const queryClient = useQueryClient();
  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetchSolPriceUsd(API_URL),
    staleTime: 60_000,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polymarketFundingLoading, setPolymarketFundingLoading] = useState(false);
  const [solAmount, setSolAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellMode, setSellMode] = useState(false);
  const [marketSide, setMarketSide] = useState<"yes" | "no">("yes");
  const [slippageBps, setSlippageBps] = useState(200);
  const [tokenPriceFetchState, setTokenPriceFetchState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [tokenPriceFetchReason, setTokenPriceFetchReason] = useState<string | null>(null);

  const [cardDisplayName, setCardDisplayName] = useState("@siren");
  const isPredictionToken = selectedToken?.assetType === "prediction";
  const selectedMarketSource = selectedMarket?.source;
  const isKalshiMarketTrade = buyPanelMode === "market" && selectedMarketSource === "kalshi";
  const isPolymarketTrade = buyPanelMode === "market" && selectedMarketSource === "polymarket";
  const walletKey = publicKey?.toBase58() ?? null;
  const deferredSolAmount = useDeferredValue(solAmount);
  const deferredSellAmount = useDeferredValue(sellAmount);

  const { data: predictionEligibility } = useQuery({
    queryKey: ["prediction-market-eligibility", buyPanelMode, selectedMarket?.ticker, selectedToken?.marketTicker],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/prediction-markets/eligibility`, { credentials: "omit" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to determine prediction market eligibility.");
      }
      return (json?.data ?? {}) as {
        blocked?: boolean;
        countryCode?: string | null;
        reason?: string | null;
      };
    },
    enabled: buyPanelOpen && (isKalshiMarketTrade || isPredictionToken),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const {
    data: dflowProofStatus,
    isLoading: dflowProofLoading,
    refetch: refetchDflowProofStatus,
    isFetching: dflowProofFetching,
  } = useQuery({
    queryKey: ["dflow-proof-status", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        return { verified: false };
      }
      const signedUrl = await appendWalletAuthQuery(
        new URL(`${API_URL}/api/dflow/proof-status?address=${encodeURIComponent(publicKey.toBase58())}`),
        { wallet: publicKey.toBase58(), signMessage, scope: "read" }
      );
      const res = await fetch(signedUrl, { credentials: "omit" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to check wallet verification.");
      }
      return (json?.data ?? { verified: false }) as { verified: boolean };
    },
    enabled: buyPanelOpen && isKalshiMarketTrade && !!publicKey,
    staleTime: 60_000,
    retry: 1,
  });
  const { data: marketActivity } = useMarketActivity(selectedMarket?.source === "kalshi" ? selectedMarket.ticker : undefined);
  const { data: goldRushIntelligence } = useGoldRushWalletIntelligence(walletKey, signMessage);
  const { data: solanaUsdcBalance = 0 } = useQuery({
    queryKey: ["solana-usdc-balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(SOLANA_USDC_MINT),
      });
      const tokenAmount = (accounts.value[0]?.account.data as { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } })?.parsed?.info?.tokenAmount?.uiAmount;
      return Number.isFinite(tokenAmount) ? tokenAmount ?? 0 : 0;
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: tokenBalance = 0 } = useQuery({
    queryKey: ["sell-token-balance", publicKey?.toBase58(), selectedToken?.mint, sellMode],
    queryFn: async () => {
      if (!publicKey || !selectedToken || !sellMode) return 0;
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(selectedToken.mint),
      });
      const acc = accounts.value[0];
      const info = (acc?.account?.data as { parsed?: { info?: { tokenAmount?: { uiAmount: number } } } })?.parsed?.info;
      return info?.tokenAmount?.uiAmount ?? 0;
    },
    enabled: !!publicKey && !!selectedToken && sellMode,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (openForSell && selectedToken) setSellMode(true);
  }, [openForSell, selectedToken?.mint]);

  useEffect(() => {
    if (!selectedMarket) return;
    if (selectedMarket.yes_mint) {
      setMarketSide("yes");
      return;
    }
    if (selectedMarket.no_mint) {
      setMarketSide("no");
    }
  }, [selectedMarket?.ticker, selectedMarket?.yes_mint, selectedMarket?.no_mint]);

  const tokenDisplayName =
    selectedToken?.name && selectedToken.name !== "-" && selectedToken.name !== "Unknown" ? selectedToken.name : selectedToken?.symbol ?? "";
  const tokenDisplaySymbol =
    selectedToken?.symbol && selectedToken.symbol !== "-" && selectedToken.symbol !== "—" ? selectedToken.symbol : selectedToken?.name ?? "";
  const marketYesPriceUsd = selectedMarket ? Math.min(1, Math.max(0, selectedMarket.probability / 100)) : null;
  const marketNoPriceUsd = selectedMarket ? Math.min(1, Math.max(0, 1 - selectedMarket.probability / 100)) : null;
  const selectedMarketPriceUsd = marketSide === "yes" ? marketYesPriceUsd : marketNoPriceUsd;
  const selectedMarketMint = marketSide === "yes" ? selectedMarket?.yes_mint : selectedMarket?.no_mint;
  const selectedPolymarketTokenId = marketSide === "yes" ? selectedMarket?.yes_token_id : selectedMarket?.no_token_id;
  const selectedMarketInstrumentId = selectedMarket?.source === "polymarket" ? selectedPolymarketTokenId : selectedMarketMint;
  const marketSpendAssetLabel = "USDC";
  const marketSpendPlaceholder = "10.00";
  const parsedBuySolAmount = parsePositiveNumber(deferredSolAmount);
  const parsedSellTokenAmount = parsePositiveNumber(deferredSellAmount);
  const predictionTradeBlocked = isKalshiMarketTrade && !!predictionEligibility?.blocked;
  const predictionTradeBlockReason =
    predictionEligibility?.reason ?? "Prediction market trading is not available in your jurisdiction right now.";
  const selectedTokenPriceUsd =
    typeof selectedToken?.price === "number" && Number.isFinite(selectedToken.price) ? selectedToken.price : null;
  const predictionMarkUsd =
    isPredictionToken && selectedToken
      ? typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) && selectedToken.price > 0
        ? selectedToken.price
        : selectedToken.marketProbability != null
          ? Math.min(1, Math.max(0, selectedToken.marketProbability / 100))
          : null
      : null;
  const effectiveSellPriceUsd = isPredictionToken ? predictionMarkUsd ?? selectedTokenPriceUsd : selectedTokenPriceUsd;
  const tradeNotionalUsd = parsedBuySolAmount != null ? parsedBuySolAmount : null;
  const estimatedContracts =
    selectedMarketPriceUsd && tradeNotionalUsd != null && tradeNotionalUsd > 0
      ? tradeNotionalUsd / selectedMarketPriceUsd
      : null;
  const marketMaxPayoutUsd = estimatedContracts != null ? estimatedContracts : null;
  const marketNetIfCorrectUsd =
    marketMaxPayoutUsd != null && tradeNotionalUsd != null ? marketMaxPayoutUsd - tradeNotionalUsd : null;
  const marketBreakEvenPct = selectedMarketPriceUsd != null ? selectedMarketPriceUsd * 100 : null;
  const tokenSellApproxUsd =
    sellMode && parsedSellTokenAmount != null && effectiveSellPriceUsd != null
      ? parsedSellTokenAmount * effectiveSellPriceUsd
      : null;
  const tokenSellMinReceiveUsd =
    tokenSellApproxUsd != null ? tokenSellApproxUsd * (1 - slippageBps / 10_000) : null;
  const tokenRouteLabel = "DFlow";
  const verificationRequired = isWalletVerificationError(error);
  const proofVerified = !!dflowProofStatus?.verified;
  const walletExecutionAlerts = (goldRushIntelligence?.alerts ?? []).filter((alert) => alert.level !== "info").slice(0, 2);

  useEffect(() => {
    const identity = publicKey?.toBase58() ?? evmAddress ?? null;
    const local = readProfileName(identity);
    if (local) {
      setCardDisplayName(formatProfileName(local));
    }
    if (publicKey) {
      fetch(`${API_URL}/api/users/profile?wallet=${encodeURIComponent(publicKey.toBase58())}`, { credentials: "omit" })
        .then((r) => r.json())
        .then((j) => {
          const serverName = j?.data?.display_name || j?.data?.username;
          if (serverName) setCardDisplayName(`@${serverName}`);
        })
        .catch(() => {});
    }
  }, [publicKey?.toBase58(), evmAddress]);

  useEffect(() => {
    if (!selectedToken || selectedToken.assetType !== "prediction") return;
    const ok =
      (typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) && selectedToken.price > 0) ||
      (selectedToken.marketProbability != null && selectedToken.marketProbability > 0);
    setTokenPriceFetchState(ok ? "ready" : "error");
    setTokenPriceFetchReason(ok ? null : "Add a mark price from your position.");
  }, [selectedToken?.mint, selectedToken?.price, selectedToken?.marketProbability, selectedToken?.assetType]);

  useEffect(() => {
    if (
      buyPanelOpen &&
      buyPanelMode === "position" &&
      selectedToken &&
      selectedToken.assetType !== "prediction"
    ) {
      setBuyPanelOpen(false);
      setSelectedToken(null);
    }
  }, [buyPanelOpen, buyPanelMode, selectedToken, setBuyPanelOpen, setSelectedToken]);

  if (!buyPanelOpen) return null;
  if (buyPanelOpen && buyPanelMode === "market" && !selectedMarket) return null;
  if (
    buyPanelOpen &&
    buyPanelMode === "position" &&
    (!selectedToken || selectedToken.assetType !== "prediction")
  ) {
    return null;
  }

  const onClose = () => {
    setBuyPanelOpen(false);
    setError(null);
    setSuccess(null);
  };

  const recordLocalTrade = ({
    mint,
    side,
    volumeSol,
    stakeUsd,
    tokenAmount,
    priceUsd,
    tokenName,
    tokenSymbol,
    txSignature,
  }: {
    mint: string;
    side: "buy" | "sell";
    volumeSol: number | null;
    /** Prediction market: USDC spent (Solana or Polygon). */
    stakeUsd?: number | null;
    tokenAmount: number | null;
    priceUsd: number | null;
    tokenName: string;
    tokenSymbol: string;
    txSignature: string;
  }) => {
    if (typeof window === "undefined" || !publicKey) return;

    if (volumeSol != null && Number.isFinite(volumeSol) && volumeSol > 0) {
      const key = `siren-volume-${publicKey.toBase58()}`;
      const raw = window.localStorage.getItem(key);
      let entries: Array<{ ts: number; mint: string; side: "buy" | "sell"; volumeSol: number }> = [];
      if (raw) {
        try {
          entries = JSON.parse(raw);
          if (!Array.isArray(entries)) entries = [];
        } catch {
          entries = [];
        }
      }
      entries.push({
        ts: Date.now(),
        mint,
        side,
        volumeSol,
      });
      if (entries.length > 500) {
        entries = entries.slice(entries.length - 500);
      }
      window.localStorage.setItem(key, JSON.stringify(entries));

      void (async () => {
        try {
          const authHeaders = await getWalletAuthHeaders({ wallet: publicKey.toBase58(), signMessage, scope: "write" });
          await fetch(`${API_URL}/api/volume/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol }),
          });
        } catch {
          /* ignore telemetry auth failures */
        }
      })();
    }

    const stake = stakeUsd != null && Number.isFinite(stakeUsd) && stakeUsd > 0 ? stakeUsd : null;
    const vol = volumeSol != null && Number.isFinite(volumeSol) && volumeSol > 0 ? volumeSol : null;
    if (tokenAmount != null && tokenAmount > 0 && priceUsd != null && priceUsd > 0 && (vol != null || stake != null)) {
      const tradesKey = `siren-trades-${publicKey.toBase58()}`;
      const rawTrades = window.localStorage.getItem(tradesKey);
      let trades: Array<{
        ts: number;
        mint: string;
        side: "buy" | "sell";
        solAmount: number;
        tokenAmount: number;
        priceUsd: number;
        stakeUsd?: number;
      }> = [];
      if (rawTrades) {
        try {
          trades = JSON.parse(rawTrades);
          if (!Array.isArray(trades)) trades = [];
        } catch {
          trades = [];
        }
      }
      trades.push({
        ts: Date.now(),
        mint,
        side,
        solAmount: vol ?? 0,
        tokenAmount,
        priceUsd,
        ...(stake != null ? { stakeUsd: stake } : {}),
      });
      if (trades.length > 1000) {
        trades = trades.slice(trades.length - 1000);
      }
      window.localStorage.setItem(tradesKey, JSON.stringify(trades));
      window.dispatchEvent(new CustomEvent("siren-activity-logged"));
    }

    void (async () => {
      try {
        const authHeaders = await getWalletAuthHeaders({ wallet: publicKey.toBase58(), signMessage, scope: "write" });
        await fetch(`${API_URL}/api/trades/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            wallet: publicKey.toBase58(),
            mint,
            side,
            tokenAmount,
            priceUsd,
            tokenName,
            tokenSymbol,
            txSignature,
            timestamp: Date.now(),
          }),
        });
      } catch {
        /* ignore telemetry auth failures */
      }
    })();
  };

  const executeSwap = async () => {
    hapticLight();
    if (!connected || !publicKey || !selectedToken || !signTransaction) {
      setError("Connect your wallet to execute trades.");
      return;
    }
    if (!isPredictionToken) {
      setError("Only prediction positions can be managed from this panel.");
      return;
    }
    setError(null);
    setSuccess(null);
    hideResultModal();
    setLoading(true);
    const isSell = !!sellMode;
    try {
      if (!isSell) {
        setError("Add size from the market trade panel.");
        setLoading(false);
        return;
      }

      let inputMint: string;
      let outputMint: string;
      let amount: string;
      const sellDecimals = 6;
      let partialSellFilled = false;

      let amountNum: number;

      const amountStr = sellAmount?.trim() || "0";
      amountNum = parseFloat(amountStr);
      if (amountNum <= 0 || !Number.isFinite(amountNum)) {
        setError("Enter a valid amount to close.");
        setLoading(false);
        return;
      }
      amount = parseUnitsToBigInt(amountStr, sellDecimals).toString();
      inputMint = selectedToken.mint;
      outputMint = SOLANA_USDC_MINT;

      const tokenPriceUsd = typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) ? selectedToken.price : null;
      const tokenNameToLog = tokenDisplayName || selectedToken.name;
      const tokenSymbolToLog = tokenDisplaySymbol || selectedToken.symbol;

      const requestSwapOrder = async (amountAtomic: string): Promise<Record<string, unknown>> => {
        const res = await fetch(`${API_URL}/api/swap/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputMint,
            outputMint,
            amount: amountAtomic,
            userPublicKey: publicKey.toBase58(),
            slippageBps,
            tryDflowFirst: true,
            forcePredictionMarket: isPredictionToken,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || data.error) {
          throw new Error(typeof data.error === "string" ? data.error : "Swap failed");
        }
        return data;
      };

      let data: Record<string, unknown>;
      try {
        data = await requestSwapOrder(amount);
      } catch (orderError) {
        const orderMsg = extractErrorMessage(orderError);
        const isRouteMiss =
          isSell &&
          isPredictionToken &&
          (orderMsg.toLowerCase().includes("route_not_found") ||
            orderMsg.toLowerCase().includes("route not found") ||
            orderMsg.toLowerCase().includes("no executable route"));
        if (!isRouteMiss) throw orderError;

        const fallbackFractions = [0.75, 0.5, 0.25, 0.1];
        let recovered: Record<string, unknown> | null = null;
        for (const fraction of fallbackFractions) {
          const candidateAmount = Number((amountNum * fraction).toFixed(6));
          if (!(candidateAmount > 0 && candidateAmount < amountNum)) continue;
          try {
            const candidateAtomic = parseUnitsToBigInt(String(candidateAmount), sellDecimals).toString();
            const candidateData = await requestSwapOrder(candidateAtomic);
            amountNum = candidateAmount;
            partialSellFilled = true;
            recovered = candidateData;
            break;
          } catch {
            // Try next smaller chunk size.
          }
        }
        if (!recovered) throw orderError;
        data = recovered;
      }
      const txB64 = typeof data.transaction === "string" ? data.transaction : "";
      if (!txB64) throw new Error("No transaction returned");
      const txBuf = base64ToUint8Array(txB64);
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");
      const asyncStatus =
        data.provider === "dflow" && data.executionMode === "async"
          ? await waitForDflowSettlement(
              sig,
              typeof data.lastValidBlockHeight === "number" ? data.lastValidBlockHeight : undefined,
            )
          : null;
      if (asyncStatus?.status === "failed" || asyncStatus?.status === "expired") {
        throw new Error(`DFlow order ${asyncStatus.status}.`);
      }

      // Track per-wallet volume and trades for Siren (local, in SOL terms)
      try {
        let volumeSol: number | null = null;
        if (tokenPriceUsd != null && tokenPriceUsd > 0 && solPriceUsd > 0) {
          const approxSolPerToken = tokenPriceUsd / solPriceUsd;
          volumeSol = amountNum * approxSolPerToken;
        }

        recordLocalTrade({
          mint: selectedToken.mint,
          side: "sell",
          volumeSol,
          tokenAmount: amountNum,
          priceUsd: tokenPriceUsd,
          tokenName: tokenNameToLog,
          tokenSymbol: tokenSymbolToLog,
          txSignature: sig,
        });
      } catch {
        // ignore volume tracking errors
      }

      setSuccess(null);
      if (isSell) setSellAmount("");
      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      setBuyPanelOpen(false);
      const realizedSummary = (() => {
        if (!isPredictionToken || !selectedToken.mint) return null;
        const entry = getPositionEntry(selectedToken.mint);
        if (!entry || tokenPriceUsd == null || tokenPriceUsd <= 0) return null;
        const soldValueUsd = amountNum * tokenPriceUsd;
        const costUsd = amountNum * (entry.avgCents / 100);
        if (costUsd <= 0) return null;
        const pnlUsd = soldValueUsd - costUsd;
        const pnlPct = (pnlUsd / costUsd) * 100;
        const marketLabel = selectedToken.marketTitle || selectedToken.name;
        return `${marketLabel} • Realized ${pnlUsd >= 0 ? "+" : "-"}$${Math.abs(pnlUsd).toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%).`;
      })();
      showResultModal({
        type: "success",
        title: data.executionMode === "async" ? "Trade submitted" : "Position closed",
        message: `${partialSellFilled ? "Partial fill executed. " : ""}${
          realizedSummary ??
          `Sold ${tokenDisplayName || selectedToken.name} (${amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} contracts).`
        }`,
        txSignature: sig,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      const friendly = getFriendlyTradeError(msg, "Swap failed. Please try again.");
      const requiresVerification = isWalletVerificationError(msg);
      logTradeFailure({
        venue: tokenRouteLabel,
        mode: isSell ? "sell" : "buy",
        tokenMint: selectedToken?.mint,
        inputAsset: isSell ? tokenDisplaySymbol : "USDC",
        outputAsset: isSell ? "USDC" : tokenDisplaySymbol,
        amount: isSell ? sellAmount : solAmount,
        wallet: publicKey?.toBase58(),
        message: msg,
      });
      setError(friendly);
      showResultModal({
        type: "error",
        title: requiresVerification ? "Verify wallet" : "Swap failed",
        message: requiresVerification
          ? "Verify this wallet once on DFlow, then come back and submit the trade again."
          : friendly,
        actionLabel: requiresVerification ? "Open DFlow Proof" : undefined,
        actionHref: requiresVerification ? DFLOW_PROOF_PORTAL_URL : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const openDflowProofFlow = async () => {
    hapticLight();
    if (!publicKey || !signMessage) {
      const message = "Connect your Solana wallet to verify it on DFlow.";
      setError(message);
      showResultModal({ type: "error", title: "Wallet required", message });
      return;
    }

    try {
      setLoading(true);
      const timestamp = Date.now();
      const message = buildProofMessage(timestamp);
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = encodeProofSignature(signatureBytes);
      const redirectUri = buildProofRedirectUri(window.location.href, publicKey.toBase58());
      const deepLink = buildProofDeepLink({
        wallet: publicKey.toBase58(),
        signature,
        timestamp,
        redirectUri,
      });

      window.open(deepLink, "_blank", "noopener,noreferrer");
      showResultModal({
        type: "info",
        title: "Complete verification",
        message:
          "We opened DFlow in a new tab. Finish verification there, then return here and submit your trade again.",
      });
    } catch (e) {
      const friendly = e instanceof Error ? e.message : "Unable to open Proof right now.";
      setError(friendly);
      showResultModal({ type: "error", title: "Verification", message: friendly });
    } finally {
      setLoading(false);
    }
  };

  const openPolymarketFundingFlow = async () => {
    hapticLight();
    if (!evmAddress) {
      const message = "Sign in to set up your Polygon wallet for Polymarket trading.";
      setError(message);
      showResultModal({ type: "error", title: "Sign in required", message });
      return;
    }

    try {
      setPolymarketFundingLoading(true);
      const result = await fundEvmWallet({
        address: evmAddress,
        options: buildPolymarketFundingConfig(solAmount.trim() || "50"),
      });
      if (result?.status === "cancelled") {
        showResultModal({
          type: "info",
          title: "Funding closed",
          message: "You closed the funding window. Open it again anytime from the trade panel.",
        });
      } else {
        showResultModal({
          type: "info",
          title: "Funding opened",
          message: "Card and Apple Pay options appear inside Privy when available.",
        });
      }
    } catch (e) {
      const friendly = e instanceof Error ? e.message : "Unable to open funding right now.";
      setError(friendly);
      showResultModal({ type: "error", title: "Funding", message: friendly });
    } finally {
      setPolymarketFundingLoading(false);
    }
  };

  const executePolymarketTrade = async () => {
    hapticLight();
    if (!selectedMarket || selectedMarket.source !== "polymarket") {
      setError("Pick a Polymarket market first.");
      return;
    }
    if (!evmAddress) {
      setError("Sign in first — your Polygon wallet is needed for Polymarket trades.");
      return;
    }
    if (!selectedPolymarketTokenId) {
      setError("This Polymarket outcome is missing a tradeable token id right now.");
      return;
    }

    const amountNum = parseFloat(solAmount?.trim() || "");
    if (!solAmount.trim() || amountNum <= 0 || !Number.isFinite(amountNum)) {
      setError("Enter a valid USDC amount (for example 10.00).");
      return;
    }

    setError(null);
    setSuccess(null);
    hideResultModal();
    setLoading(true);

    try {
      if (!switchEvmChain || !getEvmProvider) {
        throw new Error("Wallet not ready. Sign in first to enable Polymarket trading.");
      }
      await switchEvmChain(POLYGON_CHAIN_ID);
      const provider = (await getEvmProvider()) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      await provider.request({ method: "eth_requestAccounts" });

      const signer = {
        getAddress: async () => evmAddress,
        _signTypedData: async (
          domain: Record<string, unknown>,
          types: Record<string, Array<{ name: string; type: string }>>,
          value: Record<string, unknown>
        ) => {
          const primaryType = Object.keys(types).find((entry) => entry !== "EIP712Domain") ?? "ClobOrder";
          const typedData = {
            domain,
            types,
            primaryType,
            message: value,
          };

          const signature = await provider.request({
            method: "eth_signTypedData_v4",
            params: [evmAddress, JSON.stringify(typedData)],
          });

          if (typeof signature !== "string") {
            throw new Error("Polymarket signing failed.");
          }

          return signature;
        },
      };

      const { AssetType, ClobClient, OrderType, Side } = await import("@polymarket/clob-client");
      const bootstrapClient = new ClobClient(POLYMARKET_HOST, POLYGON_CHAIN_ID, signer, undefined, 0, evmAddress);
      const creds = await bootstrapClient.createOrDeriveApiKey();
      const client = new ClobClient(POLYMARKET_HOST, POLYGON_CHAIN_ID, signer, creds, 0, evmAddress);
      const [book, allowance] = await Promise.all([
        client.getOrderBook(selectedPolymarketTokenId),
        client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL }),
      ]);

      const collateralBalance = Number(allowance?.balance ?? 0) / 1_000_000;
      if (Number.isFinite(collateralBalance) && collateralBalance < amountNum) {
        throw new Error(
          `Not enough Polygon USDC in ${formatAddressShort(evmAddress)}. Fund the same EVM wallet on Polygon, then try again.`
        );
      }

      const response = await client.createAndPostMarketOrder(
        {
          tokenID: selectedPolymarketTokenId,
          amount: amountNum,
          side: Side.BUY,
          orderType: OrderType.FOK,
        },
        {
          tickSize: book.tick_size as "0.1" | "0.01" | "0.001" | "0.0001",
          negRisk: book.neg_risk,
        },
        OrderType.FOK
      );

      if (response?.success === false || response?.errorMsg) {
        throw new Error(response?.errorMsg || "Polymarket order failed.");
      }

      const txSignature =
        Array.isArray(response?.transactionsHashes) && typeof response.transactionsHashes[0] === "string"
          ? response.transactionsHashes[0]
          : undefined;

      const tokenAmountApprox = selectedMarketPriceUsd && selectedMarketPriceUsd > 0 ? amountNum / selectedMarketPriceUsd : null;
      recordLocalTrade({
        mint: selectedPolymarketTokenId,
        side: "buy",
        volumeSol: null,
        stakeUsd: amountNum,
        tokenAmount: tokenAmountApprox,
        priceUsd: selectedMarketPriceUsd,
        tokenName: `${selectedMarket.title} · ${marketSide.toUpperCase()}`,
        tokenSymbol: `${marketSide.toUpperCase()} ${selectedMarket.ticker}`,
        txSignature: txSignature ?? `poly-${Date.now()}`,
      });

      queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });

      setBuyPanelOpen(false);
      showResultModal({
        type: "success",
        title: "Polymarket order sent",
        message: `Bought ${marketSide.toUpperCase()} for ${formatUsd(amountNum, 2)} via Polygon.`,
        txSignature,
        txExplorer: "polygon",
        actionLabel: "Open source page",
        actionHref: selectedMarket.market_url,
        sharePnL: {
          token: {
            name: `${selectedMarket.title} · ${marketSide.toUpperCase()}`,
            symbol: `${marketSide.toUpperCase()} ${selectedMarket.ticker}`,
          },
          profitUsd: 0,
          percent: 0,
          kalshiMarket: selectedMarket.title,
          wallet: evmAddress ?? null,
          displayName: cardDisplayName,
          executedAt: Date.now(),
          stakeUsd: amountNum,
          valueUsd: amountNum,
        },
      });
      setSolAmount("");
    } catch (e) {
      const msg = extractErrorMessage(e);
      const friendly = getFriendlyTradeError(msg, "Polymarket trade failed. Please try again.");
      logTradeFailure({
        venue: "polymarket",
        mode: "buy-market",
        market: selectedMarket.ticker,
        side: marketSide,
        inputAsset: "Polygon USDC",
        amount: solAmount,
        wallet: evmAddress,
        message: msg,
      });
      setError(friendly);
      showResultModal({
        type: "error",
        title: "Polymarket trade failed",
        message: friendly,
      });
    } finally {
      setLoading(false);
    }
  };

  const executePredictionMarketTrade = async () => {
    hapticLight();
    if (selectedMarket?.source === "polymarket") {
      await executePolymarketTrade();
      return;
    }
    if (predictionTradeBlocked) {
      setError(predictionTradeBlockReason);
      showResultModal({ type: "error", title: "Trade unavailable", message: predictionTradeBlockReason });
      return;
    }
    if (!connected || !publicKey || !selectedMarket || !selectedMarketMint || !signTransaction) {
      setError("Connect your wallet to trade prediction markets.");
      return;
    }

    const amountNum = parseFloat(solAmount?.trim() || "");
    if (!solAmount.trim() || amountNum <= 0 || !Number.isFinite(amountNum)) {
      setError("Enter a valid USDC amount (e.g. 10.00).");
      return;
    }
    if (solanaUsdcBalance < amountNum) {
      setError(`Not enough Solana USDC. You have ${formatTokenAmount(solanaUsdcBalance, 2)} USDC ready to trade.`);
      return;
    }

    const marketPriceUsd = selectedMarketPriceUsd;
    if (marketPriceUsd == null || marketPriceUsd <= 0) {
      setError("This market does not have a usable YES/NO price yet.");
      return;
    }

    try {
      const proofResult = await refetchDflowProofStatus();
      const verified = proofResult.data?.verified ?? dflowProofStatus?.verified ?? false;
      if (!verified) {
        await openDflowProofFlow();
        return;
      }
    } catch {
      /* If Proof is temporarily unavailable, keep the current DFlow fallback path. */
    }

    setError(null);
    setSuccess(null);
    hideResultModal();
    setLoading(true);
    try {
      const amount = parseUnitsToBigInt(solAmount.trim(), 6).toString();
      const outcomeLabel = marketSide.toUpperCase();
      const outcomeSymbol = `${outcomeLabel} ${selectedMarket.ticker}`;
      const outcomeName = `${selectedMarket.title} · ${outcomeLabel}`;

      const qs = new URLSearchParams({
        inputMint: SOLANA_USDC_MINT,
        outputMint: selectedMarketMint,
        amount,
        userPublicKey: publicKey.toBase58(),
        slippageBps: String(slippageBps),
      });
      const res = await fetch(`${API_URL}/api/dflow/order?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Prediction trade failed");
      }

      const txB64 = data.transaction;
      if (!txB64) throw new Error("No transaction returned");
      const tx = VersionedTransaction.deserialize(base64ToUint8Array(txB64));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");

      const asyncStatus =
        data.provider === "dflow" && data.executionMode === "async"
          ? await waitForDflowSettlement(sig, data.lastValidBlockHeight)
          : null;
      if (asyncStatus?.status === "failed" || asyncStatus?.status === "expired") {
        throw new Error(`DFlow order ${asyncStatus.status}.`);
      }

      const tokenAmountApprox = amountNum / marketPriceUsd;
      recordLocalTrade({
        mint: selectedMarketMint,
        side: "buy",
        volumeSol: solPriceUsd > 0 ? amountNum / solPriceUsd : null,
        stakeUsd: amountNum,
        tokenAmount: tokenAmountApprox,
        priceUsd: marketPriceUsd,
        tokenName: outcomeName,
        tokenSymbol: outcomeSymbol,
        txSignature: sig,
      });

      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["dflow-positions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances", publicKey.toBase58()] });

      const sharePnLKalshi =
        tokenAmountApprox != null && tokenAmountApprox > 0 && solPriceUsd > 0
          ? {
              token: { name: outcomeName, symbol: outcomeSymbol },
              profitUsd: 0,
              percent: 0,
              kalshiMarket: selectedMarket.title,
              wallet: publicKey.toBase58(),
              displayName: cardDisplayName,
              executedAt: Date.now(),
              stakeUsd: amountNum,
              valueUsd: amountNum,
            }
          : undefined;

      setBuyPanelOpen(false);
      setSuccess(null);
      showResultModal({
        type: "success",
        title: data.executionMode === "async" ? "Trade submitted" : "Trade complete",
        message:
          data.executionMode === "async"
            ? asyncStatus?.status === "closed"
              ? `Bought ${outcomeLabel} and DFlow marked the order settled.`
              : `Bought ${outcomeLabel}. Transaction confirmed and settlement is still finalizing.`
            : `Bought ${outcomeLabel}.`,
        txSignature: sig,
        sharePnL: sharePnLKalshi,
      });
      setSolAmount("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Prediction trade failed";
      const friendly = getFriendlyTradeError(msg, "Prediction market trade failed. Please try again.");
      const requiresVerification = isWalletVerificationError(msg);
      logTradeFailure({
        venue: selectedMarket.source,
        mode: "buy-market",
        market: selectedMarket.ticker,
        side: marketSide,
        inputAsset: "USDC",
        amount: solAmount,
        wallet: publicKey?.toBase58(),
        message: msg,
      });
      setError(friendly);
      showResultModal({
        type: "error",
        title: requiresVerification ? "Verify wallet" : "Trade failed",
        message: requiresVerification
          ? "Verify this wallet once on DFlow, then come back and buy YES or NO again."
          : friendly,
        actionLabel: requiresVerification ? "Open DFlow Proof" : undefined,
        actionHref: requiresVerification ? DFLOW_PROOF_PORTAL_URL : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {buyPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 bg-black/50 md:bg-black/30"
              onClick={onClose}
            />
          </motion.div>
          <motion.div
            key="unified-buy-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-[8%] z-[51] flex w-full flex-col overflow-hidden rounded-t-[28px] border-t md:top-0 md:right-0 md:left-auto md:w-[520px] md:max-w-[520px] md:rounded-none md:border-t-0 md:border-l"
            style={{
              background: "var(--bg-surface)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0 md:px-6" style={{ borderColor: "var(--border-subtle)" }}>
              <h3 className="font-heading font-bold text-base" style={{ color: "var(--text-1)" }}>Trade</h3>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: "var(--text-3)" }} aria-label="Close">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
              <div className="flex flex-col gap-4">
                {buyPanelMode === "market" && selectedMarket && (
                  <div className="rounded-[24px] border p-5 md:p-6" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Market</p>
                    <p className="mt-2 font-heading text-lg font-bold leading-tight text-[var(--text-primary)] md:text-[1.45rem]">
                      {selectedMarket.title}
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                      {isPolymarketTrade
                        ? "Pick YES or NO and enter USDC from your Polygon wallet."
                        : "Pick YES or NO and enter USDC from your Solana wallet."}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setMarketSide("yes");
                        }}
                        disabled={!(selectedMarket.source === "polymarket" ? selectedMarket.yes_token_id : selectedMarket.yes_mint)}
                        className="rounded-[20px] border px-4 py-4 text-left transition-all disabled:opacity-40"
                        style={{
                          background: marketSide === "yes" ? "color-mix(in srgb, var(--up) 12%, var(--bg-surface))" : "var(--bg-surface)",
                          borderColor: marketSide === "yes" ? "color-mix(in srgb, var(--up) 40%, transparent)" : "var(--border-subtle)",
                        }}
                      >
                        <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: marketSide === "yes" ? "var(--up)" : "var(--text-2)" }}>
                          YES
                        </p>
                        <p className="mt-2 font-mono text-[1.65rem] font-semibold tabular-nums leading-none" style={{ color: "var(--text-1)" }}>
                          {marketYesPriceUsd != null ? `${(marketYesPriceUsd * 100).toFixed(1)}c` : "—"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setMarketSide("no");
                        }}
                        disabled={!(selectedMarket.source === "polymarket" ? selectedMarket.no_token_id : selectedMarket.no_mint)}
                        className="rounded-[20px] border px-4 py-4 text-left transition-all disabled:opacity-40"
                        style={{
                          background: marketSide === "no" ? "color-mix(in srgb, var(--down) 10%, var(--bg-surface))" : "var(--bg-surface)",
                          borderColor: marketSide === "no" ? "color-mix(in srgb, var(--down) 35%, transparent)" : "var(--border-subtle)",
                        }}
                      >
                        <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: marketSide === "no" ? "var(--down)" : "var(--text-2)" }}>
                          NO
                        </p>
                        <p className="mt-2 font-mono text-[1.65rem] font-semibold tabular-nums leading-none" style={{ color: "var(--text-1)" }}>
                          {marketNoPriceUsd != null ? `${(marketNoPriceUsd * 100).toFixed(1)}c` : "—"}
                        </p>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Price</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: marketSide === "yes" ? "var(--up)" : "var(--down)" }}>
                          {selectedMarketPriceUsd != null ? `${(selectedMarketPriceUsd * 100).toFixed(1)}c` : "—"}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Volume</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {formatCompactNumber(selectedMarket.volume_24h, 1)}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          {selectedMarket.source === "polymarket" ? "Liquidity" : "Trades 24h"}
                        </p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {selectedMarket.source === "polymarket"
                            ? formatCompactNumber(selectedMarket.liquidity, 1)
                            : formatCompactNumber(marketActivity?.recentTrades?.length, 0)}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                          {selectedMarket.source === "polymarket" ? "Wallet" : "Open interest"}
                        </p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {selectedMarket.source === "polymarket"
                            ? formatAddressShort(evmAddress)
                            : formatCompactNumber(selectedMarket.open_interest, 1)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[20px] border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                      <label className="block text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">How much</label>
                      <input
                        type="number"
                        step={isPolymarketTrade ? "0.01" : "0.001"}
                        min={isPolymarketTrade ? "1" : "0.001"}
                        placeholder={marketSpendPlaceholder}
                        value={solAmount}
                        onChange={(e) => setSolAmount(e.target.value)}
                        className="mt-3 w-full rounded-2xl border px-4 py-3.5 font-body text-lg text-[var(--text-primary)] transition-colors focus:border-[var(--border-active)] focus:outline-none"
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["5", "10", "25", "50", "100"] as const).map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setSolAmount(amt);
                            }}
                            className="rounded-full px-3.5 py-2 font-mono text-[11px] font-semibold border transition-colors"
                            style={{
                              background: solAmount === amt ? "color-mix(in srgb, var(--accent) 14%, var(--bg-elevated))" : "var(--bg-surface)",
                              borderColor: solAmount === amt ? "var(--accent)" : "var(--border-subtle)",
                              color: "var(--text-2)",
                            }}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>You pay</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {tradeNotionalUsd != null ? formatUsd(tradeNotionalUsd, 2) : "—"}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Shares</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                          {estimatedContracts != null ? formatTokenAmount(estimatedContracts, 2) : "—"}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>If you're right</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: "var(--up)" }}>
                          {marketMaxPayoutUsd != null ? formatUsd(marketMaxPayoutUsd, 2) : "—"}
                        </p>
                      </div>
                      <div className="rounded-[18px] border px-3.5 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Profit</p>
                        <p className="mt-2 font-mono text-base font-semibold tabular-nums" style={{ color: marketNetIfCorrectUsd != null && marketNetIfCorrectUsd >= 0 ? "var(--up)" : "var(--down)" }}>
                          {marketNetIfCorrectUsd != null ? formatUsd(marketNetIfCorrectUsd, 2) : "—"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                      Prices can move before your order lands. You can lose the amount you put in.
                    </p>

                    {!!goldRushIntelligence && isPredictionToken && (
                      <div
                        className="mt-4 rounded-[18px] border px-4 py-3.5"
                        style={{
                          background: "color-mix(in srgb, var(--bg-elevated) 82%, transparent)",
                          borderColor: "var(--border-subtle)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                              Wallet readiness
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                              {goldRushIntelligence.narrative.readiness}
                            </p>
                          </div>
                          <div
                            className="rounded-full border px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em]"
                            style={{
                              borderColor: goldRushIntelligence.summary.riskScore >= 70 ? "color-mix(in srgb, var(--down) 35%, transparent)" : "var(--border-subtle)",
                              color: goldRushIntelligence.summary.riskScore >= 70 ? "var(--down)" : "var(--text-3)",
                            }}
                          >
                            Risk {goldRushIntelligence.summary.riskScore}/100
                          </div>
                        </div>

                        {walletExecutionAlerts.length > 0 && (
                          <div className="mt-3 grid gap-2">
                            {walletExecutionAlerts.map((alert) => (
                              <div
                                key={`${alert.level}-${alert.label}`}
                                className="rounded-2xl border px-3 py-2.5"
                                style={{
                                  borderColor:
                                    alert.level === "high"
                                      ? "color-mix(in srgb, var(--down) 30%, transparent)"
                                      : "color-mix(in srgb, #f2c94c 28%, transparent)",
                                  background:
                                    alert.level === "high"
                                      ? "color-mix(in srgb, var(--down) 8%, var(--bg-surface))"
                                      : "color-mix(in srgb, #f2c94c 8%, var(--bg-surface))",
                                }}
                              >
                                <p
                                  className="text-[10px] uppercase tracking-[0.14em]"
                                  style={{ color: alert.level === "high" ? "var(--down)" : "#f2c94c" }}
                                >
                                  {alert.label}
                                </p>
                                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                                  {alert.summary}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {predictionTradeBlocked && (
                      <div
                        className="mt-4 rounded-[18px] border px-4 py-3.5"
                        style={{
                          background: "color-mix(in srgb, var(--down) 10%, var(--bg-surface))",
                          borderColor: "color-mix(in srgb, var(--down) 30%, var(--border-subtle))",
                        }}
                      >
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--down)" }}>
                          Trade unavailable
                        </p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {predictionTradeBlockReason}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={executePredictionMarketTrade}
                      disabled={loading || !selectedMarketInstrumentId || predictionTradeBlocked}
                      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-heading text-sm font-bold uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50"
                      style={{
                        background: marketSide === "yes" ? "var(--accent)" : "var(--down)",
                        color: "var(--bg-base)",
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Building order...
                        </>
                      ) : predictionTradeBlocked ? (
                        "Unavailable in your region"
                      ) : isKalshiMarketTrade && !proofVerified && !dflowProofLoading ? (
                        "Verify wallet first"
                      ) : (
                        `Buy ${marketSide.toUpperCase()}`
                      )}
                    </button>

                    <a
                      href={selectedMarket.market_url || selectedMarket.kalshi_url || (selectedMarket.source === "polymarket" ? "https://polymarket.com" : "https://kalshi.com")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border font-body text-sm font-medium transition-all duration-100 hover:brightness-110"
                      style={{ background: "var(--bg-surface)", color: "var(--text-2)", borderColor: "var(--border-subtle)" }}
                    >
                      Market page
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div
                      className="mt-3 rounded-[18px] border px-4 py-3.5"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    >
                      {isKalshiMarketTrade ? (
                        <>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: proofVerified ? "var(--up)" : "var(--accent)" }}>
                            {proofVerified ? "Wallet verified" : "Wallet verification"}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                            {proofVerified
                              ? "Your wallet is ready."
                              : "Kalshi needs a one-time identity check before your first trade."}
                          </p>
                          {!proofVerified && (
                            <button
                              type="button"
                              onClick={openDflowProofFlow}
                              className="mt-2 inline-flex items-center gap-2 text-xs font-medium"
                              style={{ color: "var(--accent)" }}
                            >
                              {dflowProofFetching ? "Checking wallet..." : "Verify identity"}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--polymarket)" }}>
                            Polymarket wallet
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                            Polymarket trades use your Polygon wallet. Add USDC there before you buy.
                          </p>
                          <button
                            type="button"
                            onClick={openPolymarketFundingFlow}
                            disabled={polymarketFundingLoading || !evmAddress}
                            className="mt-2 inline-flex items-center gap-2 text-xs font-medium disabled:opacity-60"
                            style={{ color: "var(--polymarket)" }}
                          >
                            {polymarketFundingLoading ? "Opening funding..." : "Add Polygon USDC"}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                            DFlow proof is only needed for Kalshi/DFlow markets. Polymarket uses your Polygon wallet.
                          </p>
                        </>
                      )}
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                      {isPolymarketTrade
                        ? "This can take a few seconds while your wallet signs and the order lands."
                        : "This can take a few seconds after your wallet confirms."}
                    </p>
                  </div>
                )}
                {buyPanelMode === "position" && selectedToken && (
                  <>
                    <div
                      className="rounded-xl border p-4 md:p-5"
                      style={{
                        background: "var(--bg-elevated)",
                        borderColor: "var(--border-subtle)",
                        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)",
                      }}
                    >
                      <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Prediction position</p>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setSellMode(true)}
                          className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                          style={
                            sellMode
                              ? { background: "var(--accent)" }
                              : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }
                          }
                        >
                          Close
                        </button>
                      </div>
                      <p className="font-heading font-bold text-[var(--text-primary)]">{tokenDisplayName}</p>
                      <p className="font-body text-[var(--accent-primary)] text-sm mt-1 tabular-nums">
                        {tokenPriceFetchState === "loading"
                          ? "Fetching price..."
                          : selectedToken.price != null
                            ? `Mark ${formatUsd(selectedToken.price, 3)}`
                            : `Price unavailable${tokenPriceFetchReason ? `: ${tokenPriceFetchReason}` : ""}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedToken.marketSide && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{
                              background: selectedToken.marketSide === "yes" ? "var(--accent-dim)" : "var(--down-dim)",
                              color: selectedToken.marketSide === "yes" ? "var(--accent)" : "var(--down)",
                            }}
                          >
                            {selectedToken.marketSide.toUpperCase()}
                          </span>
                        )}
                        {selectedToken.marketTicker && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{ background: "var(--bg-surface)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
                          >
                            {selectedToken.marketTicker}
                          </span>
                        )}
                        {selectedToken.marketProbability != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                            YES {selectedToken.marketProbability.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {!sellMode ? (
                        <div className="mt-3 rounded-xl border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                          <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                            Add to this position from the market panel so you can choose YES or NO without clutter.
                          </p>
                          <a
                            href={selectedToken.kalshiUrl || selectedMarket?.kalshi_url || "https://kalshi.com"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-xs"
                            style={{ color: "var(--accent)" }}
                          >
                            Open market reference
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3">
                            <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount of {tokenDisplayName} to close</label>
                            <div className="flex gap-1.5 mb-2">
                              {([25, 50, 75, 100] as const).map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => {
                                    hapticLight();
                                    const amt = tokenBalance > 0 ? (tokenBalance * pct) / 100 : 0;
                                    setSellAmount(amt > 0 ? amt.toString() : "");
                                  }}
                                  className="flex-1 py-1.5 rounded-md text-[11px] font-heading font-semibold transition-all duration-100"
                                  style={{
                                    background: "var(--bg-surface)",
                                    color: "var(--text-2)",
                                    border: "1px solid var(--border-subtle)",
                                  }}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder={tokenBalance > 0 ? tokenBalance.toLocaleString() : "0"}
                              value={sellAmount}
                              onChange={(e) => setSellAmount(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg font-body text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                              style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                            />
                          </div>
                          <div className="mt-3 rounded-xl border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                            <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
                              Payout preview
                            </p>
                            <div className="space-y-2">
                              <div className="flex justify-between gap-3 font-body text-sm" style={{ color: "var(--text-1)" }}>
                                <span style={{ color: "var(--text-3)" }}>Selling</span>
                                <span className="font-mono tabular-nums">
                                  {parsedSellTokenAmount != null ? `${formatTokenAmount(parsedSellTokenAmount, 2)} contracts` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-3 font-body text-sm" style={{ color: "var(--text-1)" }}>
                                <span style={{ color: "var(--text-3)" }}>Est. USDC (at mark)</span>
                                <span className="font-mono tabular-nums font-semibold" style={{ color: "var(--accent)" }}>
                                  {tokenSellApproxUsd != null ? formatUsd(tokenSellApproxUsd, 2) : "—"}
                                </span>
                              </div>
                              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                                Mark is the live YES price. Final fill may differ slightly when the transaction lands.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={executeSwap}
                            disabled={loading}
                            className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: "var(--accent)", color: "var(--bg-base)", height: "36px" }}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Closing…
                              </>
                            ) : (
                              "Sell position for USDC"
                            )}
                          </button>
                        </>
                      )}
                      <div className="mt-3 md:mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase text-[var(--text-3)] mb-1">{sellMode ? "Note" : "Marking guide"}</p>
                        {sellMode ? (
                          <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                            You are closing part or all of this position. USDC returns to your Solana wallet after confirmation.
                          </p>
                        ) : (
                          <div className="rounded-lg border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                            <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                              Add size from the market panel. Prices follow live YES probability; closes route back to USDC on Solana.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!sellMode && (
                      <div
                        className="rounded-xl border p-4 flex flex-col"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--border-subtle)",
                          boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)",
                        }}
                      >
                        <p className="text-[var(--text-secondary)] text-xs uppercase mb-3">Position info</p>
                        <div className="space-y-2 text-sm">
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Mark price</span>
                            <span className="font-body text-[var(--accent-primary)] tabular-nums">
                              {selectedToken.price != null ? `$${selectedToken.price.toFixed(6)}` : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Side</span>
                            <span className="font-body text-[var(--text-2)]">{selectedToken.marketSide?.toUpperCase() ?? "—"}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Market</span>
                            <span
                              className="font-body text-[var(--text-2)] truncate pl-4"
                              title={selectedToken.marketTitle ?? selectedMarket?.title}
                            >
                              {selectedToken.marketTicker ?? selectedMarket?.ticker ?? "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Reference YES</span>
                            <span className="font-body text-[var(--accent)] tabular-nums">
                              {selectedToken.marketProbability != null ? `${selectedToken.marketProbability.toFixed(1)}%` : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Routing</span>
                            <span className="text-[var(--text-2)]">DFlow</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Settlement</span>
                            <span className="text-[var(--text-2)]">Async</span>
                          </p>
                        </div>
                        <p className="text-[10px] text-[var(--text-3)] mt-3 leading-relaxed">
                          Prediction positions are marked from live market probability and closed through DFlow outcome-token routing.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              {!resultModalOpen && error && <p className="text-sm mt-3" style={{ color: "var(--down)" }}>{error}</p>}
              {!resultModalOpen && verificationRequired && (
                <a
                  href={DFLOW_PROOF_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Verify identity
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {!resultModalOpen && success && <p className="text-sm mt-3" style={{ color: "var(--accent)" }}>{success}</p>}
              <p className="text-[var(--text-secondary)] text-[11px] mt-3 leading-relaxed">
                Use market mode to buy YES or NO. Position mode is for closing Kalshi outcome holdings from your portfolio. USDC funds Solana and Polymarket trades; Kalshi may require a one-time DFlow wallet verification.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
