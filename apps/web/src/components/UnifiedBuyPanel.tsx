"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Copy, Check, Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useFundWallet as useEvmFundWallet } from "@privy-io/react-auth";
import { useSirenStore } from "@/store/useSirenStore";
import { useResultModalStore } from "@/store/useResultModalStore";
import { TradePnLCard, type TradePnLToken } from "./TradePnLCard";
import { useMarketActivity } from "@/hooks/useMarketActivity";
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
import { fetchSolPriceUsd } from "@/lib/pricing";
import { API_URL } from "@/lib/apiUrl";
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

function isBagsMint(mint?: string | null): boolean {
  return !!mint && mint.toLowerCase().endsWith("bags");
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
  if (lower.includes("user rejected") || lower.includes("rejected the request") || lower.includes("4001")) {
    return "Wallet signature was canceled.";
  }
  if (lower.includes("not tradable")) {
    return "This market is not routable right now. Refresh and try again in a moment.";
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

async function getMintDecimals(conn: any, mint: string): Promise<number> {
  const info = await conn.getParsedAccountInfo(new PublicKey(mint));
  const parsed = info.value ? (info.value.data as any)?.parsed : null;
  const decimals = parsed?.info?.decimals;
  if (typeof decimals !== "number") throw new Error("Unable to fetch mint decimals");
  return decimals;
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

const MOCK_CHART_DATA = [
  { t: "0h", v: 0.0003 },
  { t: "4h", v: 0.00035 },
  { t: "8h", v: 0.00032 },
  { t: "12h", v: 0.00038 },
  { t: "16h", v: 0.0004 },
  { t: "20h", v: 0.00042 },
  { t: "24h", v: 0.00042 },
];

/** DexScreener-based signal: volume tier + keyword match. */
function TokenSignalSection({
  volume24h,
  matchedMarketTitle,
}: {
  volume24h?: number;
  matchedMarketTitle?: string;
}) {
  const vol = volume24h ?? 0;
  const tier = vol >= 10_000 ? "High" : vol >= 1_000 ? "Medium" : vol > 0 ? "Low" : null;
  return (
    <div
      className="rounded-xl border mt-3 px-4 py-3"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
    >
      <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider mb-2">Signal (DexScreener)</p>
      <div className="flex flex-wrap gap-2">
        {tier && (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px]"
            style={{
              background: tier === "High" ? "color-mix(in srgb, var(--up) 14%, var(--bg-surface))" : "var(--bg-surface)",
              color: tier === "High" ? "var(--up)" : "var(--text-2)",
              border: `1px solid ${tier === "High" ? "color-mix(in srgb, var(--up) 30%, transparent)" : "var(--border-subtle)"}`,
            }}
          >
            Vol {tier}
          </span>
        )}
        {matchedMarketTitle && (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] truncate max-w-[180px]"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, var(--bg-surface))",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)",
            }}
            title={matchedMarketTitle}
          >
            {matchedMarketTitle.slice(0, 28)}{matchedMarketTitle.length > 28 ? "…" : ""}
          </span>
        )}
        {!tier && !matchedMarketTitle && (
          <span className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            No volume or market match data
          </span>
        )}
      </div>
    </div>
  );
}

/** X/Twitter mentions (requires TWITTER_BEARER_TOKEN on API). */
function TokenTweetsSection({ mint }: { mint: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: tweets = [], isLoading, isError, error } = useQuery({
    queryKey: ["token-tweets", mint],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/token-tweets?mint=${encodeURIComponent(mint)}`, { credentials: "omit" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to fetch");
      return j.data ?? [];
    },
    enabled: expanded && !!mint && mint.length >= 32,
    staleTime: 60_000,
    retry: false,
  });
  return (
    <div className="rounded-xl border mt-3" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
      >
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>CT mentions (X)</span>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-3)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-3)" }} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          {isLoading ? (
            <p className="font-body text-xs py-4" style={{ color: "var(--text-3)" }}>Loading…</p>
          ) : isError ? (
            <p className="font-body text-xs py-4" style={{ color: "var(--text-3)" }}>
              {String(error).includes("not configured") ? "Set TWITTER_BEARER_TOKEN in API to enable X search." : "Unable to load."}
            </p>
          ) : tweets.length === 0 ? (
            <p className="font-body text-xs py-4" style={{ color: "var(--text-3)" }}>No recent mentions.</p>
          ) : (
            <ul className="space-y-3 max-h-40 overflow-y-auto">
              {tweets.map((t: { id: string; text: string; created_at?: string }) => (
                <li key={t.id} className="font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  <p className="line-clamp-3">{t.text}</p>
                  {t.created_at && (
                    <a href={`https://x.com/i/status/${t.id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] mt-1 inline-block" style={{ color: "var(--accent)" }}>
                      View on X
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CopyCAButton({ mint }: { mint: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isValid = mint && mint.length >= 32 && !mint.startsWith("mock");
  if (!isValid) return null;
  return (
    <button
      onClick={handleCopy}
      className="mt-2 flex items-center gap-2 text-xs font-body text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-100"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--accent-bags)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy CA"}
    </button>
  );
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

  type TradePnLCardModel = {
    token: TradePnLToken;
    profitUsd: number;
    percent: number;
    kalshiMarket: string;
    wallet: string | null;
    executedAt: number;
  };
  const [tradePnLModalOpen, setTradePnLModalOpen] = useState(false);
  const [tradePnLData, setTradePnLData] = useState<TradePnLCardModel | null>(null);
  const [cardDisplayName, setCardDisplayName] = useState("@siren");
  const isPredictionToken = selectedToken?.assetType === "prediction";
  const selectedMarketSource = selectedMarket?.source;
  const isKalshiMarketTrade = buyPanelMode === "market" && selectedMarketSource === "kalshi";
  const isPolymarketTrade = buyPanelMode === "market" && selectedMarketSource === "polymarket";
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
      const res = await fetch(`${API_URL}/api/dflow/proof-status?address=${encodeURIComponent(publicKey.toBase58())}`, {
        credentials: "omit",
      });
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
  const tokenBuyApproxReceive =
    !sellMode && !isPredictionToken && tradeNotionalUsd != null && selectedTokenPriceUsd != null && selectedTokenPriceUsd > 0
      ? tradeNotionalUsd / selectedTokenPriceUsd
      : null;
  const tokenBuyMinReceive =
    tokenBuyApproxReceive != null ? tokenBuyApproxReceive * (1 - slippageBps / 10_000) : null;
  const tokenSellApproxUsd =
    sellMode && parsedSellTokenAmount != null && effectiveSellPriceUsd != null
      ? parsedSellTokenAmount * effectiveSellPriceUsd
      : null;
  const tokenSellMinReceiveUsd =
    tokenSellApproxUsd != null ? tokenSellApproxUsd * (1 - slippageBps / 10_000) : null;
  const tokenRouteLabel = isPredictionToken ? "DFlow" : isBagsMint(selectedToken?.mint) ? "Bags" : "Jupiter";
  const verificationRequired = isWalletVerificationError(error);
  const proofVerified = !!dflowProofStatus?.verified;

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
    let cancelled = false;
    async function run() {
      if (!selectedToken) return;
      if (selectedToken.assetType === "prediction") {
        const ok =
          (typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) && selectedToken.price > 0) ||
          (selectedToken.marketProbability != null && selectedToken.marketProbability > 0);
        setTokenPriceFetchState(ok ? "ready" : "error");
        setTokenPriceFetchReason(ok ? null : "Add a mark price from your position.");
        return;
      }
      // Fetch price/name on-demand if we don't have a usable USD price yet.
      const needsPrice = selectedToken.price == null || !Number.isFinite(selectedToken.price);
      const needsNameOrSymbol =
        !selectedToken.name || selectedToken.name === "Unknown" || selectedToken.name === "-" || !selectedToken.symbol || selectedToken.symbol === "-" || selectedToken.symbol === "—";
      if (!needsPrice && !needsNameOrSymbol) return;
      setTokenPriceFetchState("loading");
      setTokenPriceFetchReason(null);
      try {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[UnifiedBuyPanel] fetching token info", {
            mint: selectedToken.mint,
            sellMode,
            openForSell,
          });
        }
        const res = await fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(selectedToken.mint)}`, { credentials: "omit" });
        const j = await res.json();
        if (!res.ok || !j?.data) {
          throw new Error(j?.error || "Token info unavailable");
        }
        const d = j.data as {
          name?: string;
          symbol?: string;
          priceUsd?: number;
          volume24h?: number;
          liquidityUsd?: number;
          fdvUsd?: number;
          holders?: number;
          bondingCurveStatus?: "bonded" | "bonding" | "unknown";
          rugcheckScore?: number;
          safe?: boolean;
          riskScore?: number;
          riskLabel?: "low" | "moderate" | "high" | "critical";
          riskReasons?: string[];
          riskBlocked?: boolean;
        };
        const nextName = d.name ?? selectedToken.name;
        const nextSymbolRaw = d.symbol ?? selectedToken.symbol;
        const nextSymbol =
          nextSymbolRaw && nextSymbolRaw !== "-" && nextSymbolRaw !== "—" ? nextSymbolRaw : (nextName && nextName !== "Unknown" ? nextName : selectedToken.symbol);
        const nextPrice = typeof d.priceUsd === "number" && Number.isFinite(d.priceUsd) ? d.priceUsd : undefined;

        if (cancelled) return;
        setSelectedToken(
          {
            ...selectedToken,
            name: nextName,
            symbol: nextSymbol,
            price: nextPrice,
            volume24h: d.volume24h ?? selectedToken.volume24h,
            liquidityUsd: d.liquidityUsd ?? selectedToken.liquidityUsd,
            fdvUsd: d.fdvUsd ?? selectedToken.fdvUsd,
            holders: d.holders ?? selectedToken.holders,
            bondingCurveStatus: d.bondingCurveStatus ?? selectedToken.bondingCurveStatus,
            rugcheckScore: d.rugcheckScore ?? selectedToken.rugcheckScore,
            safe: d.safe ?? selectedToken.safe,
            riskScore: d.riskScore ?? selectedToken.riskScore,
            riskLabel: d.riskLabel ?? selectedToken.riskLabel,
            riskReasons: d.riskReasons ?? selectedToken.riskReasons,
            riskBlocked: d.riskBlocked ?? selectedToken.riskBlocked,
          },
          { openForSell: sellMode || openForSell }
        );
        setTokenPriceFetchState(nextPrice != null ? "ready" : "error");
        setTokenPriceFetchReason(nextPrice != null ? null : "No reliable USD quote for this mint yet.");
      } catch (e) {
        if (cancelled) return;
        setTokenPriceFetchState("error");
        setTokenPriceFetchReason(e instanceof Error ? e.message : "Unable to load token price.");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedToken?.mint, selectedToken?.price, selectedToken?.name, selectedToken?.symbol, sellMode, openForSell]);

  if (!buyPanelOpen && !tradePnLModalOpen) return null;
  if (buyPanelOpen && buyPanelMode === "market" && !selectedMarket) return null;
  if (buyPanelOpen && buyPanelMode === "token" && !selectedToken) return null;

  const onClose = () => {
    setBuyPanelOpen(false);
    setError(null);
    setSuccess(null);
    setTradePnLModalOpen(false);
    setTradePnLData(null);
  };
  const buyBlocked = !!selectedToken?.riskBlocked && !sellMode;
  const riskScore = selectedToken?.riskScore ?? 0;
  const riskReasons = selectedToken?.riskReasons ?? [];
  const riskLabel = selectedToken?.riskLabel ?? "low";

  const recordLocalTrade = ({
    mint,
    side,
    volumeSol,
    tokenAmount,
    priceUsd,
    tokenName,
    tokenSymbol,
    txSignature,
  }: {
    mint: string;
    side: "buy" | "sell";
    volumeSol: number | null;
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

      fetch(`${API_URL}/api/volume/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol }),
      }).catch(() => {});
    }

    if (
      tokenAmount != null &&
      tokenAmount > 0 &&
      priceUsd != null &&
      priceUsd > 0 &&
      volumeSol != null &&
      Number.isFinite(volumeSol)
    ) {
      const tradesKey = `siren-trades-${publicKey.toBase58()}`;
      const rawTrades = window.localStorage.getItem(tradesKey);
      let trades: Array<{
        ts: number;
        mint: string;
        side: "buy" | "sell";
        solAmount: number;
        tokenAmount: number;
        priceUsd: number;
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
        solAmount: volumeSol,
        tokenAmount,
        priceUsd,
      });
      if (trades.length > 1000) {
        trades = trades.slice(trades.length - 1000);
      }
      window.localStorage.setItem(tradesKey, JSON.stringify(trades));
    }

    fetch(`${API_URL}/api/trades/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    }).catch(() => {});
  };

  const executeSwap = async () => {
    hapticLight();
    if (!connected || !publicKey || !selectedToken || !signTransaction) {
      setError("Connect your wallet to execute trades.");
      return;
    }
    if (!sellMode && selectedToken.riskBlocked) {
      const reason = riskReasons[0] ?? "This token looks too risky to trade.";
      const msg = `Risk trade analysed. ${reason}.`;
      setError(msg);
      showResultModal({ type: "error", title: "Trade blocked", message: msg });
      return;
    }
    setError(null);
    setSuccess(null);
    hideResultModal();
    setLoading(true);
    const isSell = !!sellMode;
    try {
      let inputMint: string;
      let outputMint: string;
      let amount: string;

      let amountNum: number;

      if (isSell) {
        const amountStr = sellAmount?.trim() || "0";
        amountNum = parseFloat(amountStr);
        if (amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid token amount to sell.");
          setLoading(false);
          return;
        }
        const decimals = await getMintDecimals(connection, selectedToken.mint);
        amount = parseUnitsToBigInt(amountStr, decimals).toString();
        inputMint = selectedToken.mint;
        outputMint = SOLANA_USDC_MINT;
      } else {
        const amountStr = solAmount?.trim() || "";
        amountNum = parseFloat(amountStr);
        if (!amountStr || amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid USDC amount (e.g. 10.00).");
          setLoading(false);
          return;
        }
        amount = parseUnitsToBigInt(amountStr, 6).toString();
        inputMint = SOLANA_USDC_MINT;
        outputMint = selectedToken.mint;
        if (solanaUsdcBalance < amountNum) {
          setError(`Not enough Solana USDC. You have ${formatTokenAmount(solanaUsdcBalance, 2)} USDC ready to trade.`);
          setLoading(false);
          return;
        }
      }

      const tokenPriceUsd = typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) ? selectedToken.price : null;
      const tokenNameToLog = tokenDisplayName || selectedToken.name;
      const tokenSymbolToLog = tokenDisplaySymbol || selectedToken.symbol;

      // For the Trade PnL card (buy flows)
      let tokenAmountForPnL: number | null = null;
      let boughtUsdForPnL: number | null = null;
      if (!isSell && tokenPriceUsd != null && tokenPriceUsd > 0 && Number.isFinite(amountNum)) {
        boughtUsdForPnL = amountNum;
        tokenAmountForPnL = amountNum / tokenPriceUsd;
      }

      const res = await fetch(`${API_URL}/api/swap/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount,
          userPublicKey: publicKey.toBase58(),
          slippageBps,
          tryDflowFirst: true,
          forcePredictionMarket: isPredictionToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Swap failed");
      }
      const txB64 = data.transaction;
      if (!txB64) throw new Error("No transaction returned");
      const txBuf = base64ToUint8Array(txB64);
      const tx = VersionedTransaction.deserialize(txBuf);
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

      // Track per-wallet volume and trades for Siren (local, in SOL terms)
      try {
        let volumeSol: number | null = null;
        let tokenAmountApprox: number | null = null;

        if (isSell) {
          if (tokenPriceUsd != null && tokenPriceUsd > 0 && solPriceUsd > 0) {
            tokenAmountApprox = amountNum;
            const approxSolPerToken = tokenPriceUsd / solPriceUsd;
            volumeSol = amountNum * approxSolPerToken;
          }
        } else {
          volumeSol = solPriceUsd > 0 ? amountNum / solPriceUsd : null;
          if (tokenPriceUsd != null && tokenPriceUsd > 0) {
            tokenAmountApprox = amountNum / tokenPriceUsd;
          }
        }

        recordLocalTrade({
          mint: selectedToken.mint,
          side: isSell ? "sell" : "buy",
          volumeSol,
          tokenAmount: isSell ? amountNum : tokenAmountApprox,
          priceUsd: tokenPriceUsd,
          tokenName: tokenNameToLog,
          tokenSymbol: tokenSymbolToLog,
          txSignature: sig,
        });
      } catch {
        // ignore volume tracking errors
      }

      // Show screenshot-matching Trade PnL card after successful BUY (for quick testing).
      if (!isSell && tokenAmountForPnL != null && boughtUsdForPnL != null && tokenAmountForPnL > 0 && boughtUsdForPnL > 0) {
        try {
          const res = await fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(selectedToken.mint)}`, { credentials: "omit" });
          const j = await res.json();
          const currentPriceUsd = typeof j?.data?.priceUsd === "number" && Number.isFinite(j.data.priceUsd) ? j.data.priceUsd : null;

          const currentValueUsd = currentPriceUsd != null ? tokenAmountForPnL * currentPriceUsd : boughtUsdForPnL;
          const profitUsdCard = currentValueUsd - boughtUsdForPnL;
          const percentCard = boughtUsdForPnL > 0 ? (profitUsdCard / boughtUsdForPnL) * 100 : 0;

          const kalshiTitle =
            buyPanelMode === "market" && selectedMarket?.title ? selectedMarket.title : selectedMarket?.title ?? "Signal from Kalshi";

          setTradePnLData({
            token: {
              name: tokenDisplayName || selectedToken.name,
              symbol: tokenDisplaySymbol || selectedToken.symbol,
            },
            profitUsd: profitUsdCard,
            percent: percentCard,
            kalshiMarket: kalshiTitle,
            wallet: publicKey.toBase58(),
            executedAt: Date.now(),
          });
          setTradePnLModalOpen(true);
          setBuyPanelOpen(false);
          hideResultModal();
          setSuccess(null);
          return;
        } catch {
          // If price fetch fails, still show regular success UI.
        }
      }

      setSuccess(null);
      if (isSell) setSellAmount("");
      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      showResultModal({
        type: "success",
        title: data.executionMode === "async" ? "Trade submitted" : "Swap complete",
        message: isSell
          ? `Sold ${tokenDisplayName || selectedToken.name} (${amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens).`
          : data.executionMode === "async"
            ? asyncStatus?.status === "closed"
              ? "Trade confirmed and settled."
              : "Transaction confirmed. Settlement is still being finalized by DFlow."
            : "Swap successful.",
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
        tokenAmount: tokenAmountApprox,
        priceUsd: selectedMarketPriceUsd,
        tokenName: `${selectedMarket.title} · ${marketSide.toUpperCase()}`,
        tokenSymbol: `${marketSide.toUpperCase()} ${selectedMarket.ticker}`,
        txSignature: txSignature ?? `poly-${Date.now()}`,
      });

      showResultModal({
        type: "success",
        title: "Polymarket order sent",
        message: `Bought ${marketSide.toUpperCase()} for ${formatUsd(amountNum, 2)} via Polygon.`,
        txSignature,
        actionLabel: "Open market page",
        actionHref: selectedMarket.market_url,
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
        tokenAmount: tokenAmountApprox,
        priceUsd: marketPriceUsd,
        tokenName: outcomeName,
        tokenSymbol: outcomeSymbol,
        txSignature: sig,
      });

      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });

      if (tokenAmountApprox != null && tokenAmountApprox > 0 && solPriceUsd > 0) {
        setTradePnLData({
          token: {
            name: outcomeName,
            symbol: outcomeSymbol,
          },
          profitUsd: 0,
          percent: 0,
          kalshiMarket: selectedMarket.title,
          wallet: publicKey.toBase58(),
          executedAt: Date.now(),
        });
        setTradePnLModalOpen(true);
        setBuyPanelOpen(false);
        hideResultModal();
        setSuccess(null);
        return;
      }

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
            className="fixed top-0 right-0 bottom-0 z-[51] w-full max-w-[420px] md:w-[400px] flex flex-col overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--border-subtle)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
            }}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
              <h3 className="font-heading font-bold text-sm" style={{ color: "var(--accent)" }}>Trade</h3>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: "var(--text-3)" }} aria-label="Close">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col gap-4">
                {buyPanelMode === "market" && selectedMarket && (
                  <div className="rounded-xl border p-4 md:p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Trade market</p>
                    <p className="font-heading font-bold text-[var(--text-primary)] text-sm line-clamp-3">{selectedMarket.title}</p>
                    <p className="font-body text-xs mt-2" style={{ color: "var(--text-3)" }}>
                      {isPolymarketTrade
                        ? "Pick YES or NO, enter a USDC amount, and Siren will route through your Polygon wallet."
                        : "Pick YES or NO, enter Solana USDC, and Siren will build the order for you."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setMarketSide("yes");
                        }}
                        disabled={!(selectedMarket.source === "polymarket" ? selectedMarket.yes_token_id : selectedMarket.yes_mint)}
                        className="rounded-xl border px-3 py-3 text-left transition-all disabled:opacity-40"
                        style={{
                          background: marketSide === "yes" ? "color-mix(in srgb, var(--up) 12%, var(--bg-surface))" : "var(--bg-surface)",
                          borderColor: marketSide === "yes" ? "color-mix(in srgb, var(--up) 40%, transparent)" : "var(--border-subtle)",
                        }}
                      >
                        <p className="font-heading text-xs font-semibold uppercase tracking-wide" style={{ color: marketSide === "yes" ? "var(--up)" : "var(--text-2)" }}>
                          YES
                        </p>
                        <p className="font-mono text-lg tabular-nums mt-1" style={{ color: "var(--text-1)" }}>
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
                        className="rounded-xl border px-3 py-3 text-left transition-all disabled:opacity-40"
                        style={{
                          background: marketSide === "no" ? "color-mix(in srgb, var(--down) 10%, var(--bg-surface))" : "var(--bg-surface)",
                          borderColor: marketSide === "no" ? "color-mix(in srgb, var(--down) 35%, transparent)" : "var(--border-subtle)",
                        }}
                      >
                        <p className="font-heading text-xs font-semibold uppercase tracking-wide" style={{ color: marketSide === "no" ? "var(--down)" : "var(--text-2)" }}>
                          NO
                        </p>
                        <p className="font-mono text-lg tabular-nums mt-1" style={{ color: "var(--text-1)" }}>
                          {marketNoPriceUsd != null ? `${(marketNoPriceUsd * 100).toFixed(1)}c` : "—"}
                        </p>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border px-3 py-2.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>YES price</p>
                        <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--kalshi)" }}>
                          {marketYesPriceUsd != null ? `${(marketYesPriceUsd * 100).toFixed(1)}c` : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border px-3 py-2.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>24h volume</p>
                        <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                          {formatCompactNumber(selectedMarket.volume_24h, 1)}
                        </p>
                      </div>
                      <div className="rounded-xl border px-3 py-2.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                          {selectedMarket.source === "polymarket" ? "Liquidity" : "Trades 24h"}
                        </p>
                        <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                          {selectedMarket.source === "polymarket"
                            ? formatCompactNumber(selectedMarket.liquidity, 1)
                            : formatCompactNumber(marketActivity?.recentTrades?.length, 0)}
                        </p>
                      </div>
                      <div className="rounded-xl border px-3 py-2.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                          {selectedMarket.source === "polymarket" ? "Wallet" : "Open interest"}
                        </p>
                        <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                          {selectedMarket.source === "polymarket"
                            ? formatAddressShort(evmAddress)
                            : formatCompactNumber(selectedMarket.open_interest, 1)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount to spend ({marketSpendAssetLabel})</label>
                      <input
                        type="number"
                        step={isPolymarketTrade ? "0.01" : "0.001"}
                        min={isPolymarketTrade ? "1" : "0.001"}
                        placeholder={marketSpendPlaceholder}
                        value={solAmount}
                        onChange={(e) => setSolAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg font-body text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                      />
                    </div>

                    <div className="mt-3 rounded-xl border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                      <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Trade preview</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Current {marketSide.toUpperCase()} price</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: marketSide === "yes" ? "var(--up)" : "var(--down)" }}>
                            {formatUsd(selectedMarketPriceUsd, 3)}
                          </p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>You pay</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                            {tradeNotionalUsd != null ? formatUsd(tradeNotionalUsd, 2) : "—"}
                          </p>
                          <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                            {parsedBuySolAmount != null
                              ? `${formatTokenAmount(parsedBuySolAmount, isPolymarketTrade ? 2 : 4)} ${marketSpendAssetLabel}`
                              : `Enter a ${marketSpendAssetLabel} amount`}
                          </p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Estimated {marketSide.toUpperCase()} shares</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                            {estimatedContracts != null ? formatTokenAmount(estimatedContracts, 2) : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Max payout if {marketSide.toUpperCase()}</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--up)" }}>
                            {marketMaxPayoutUsd != null ? formatUsd(marketMaxPayoutUsd, 2) : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Net if correct</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: marketNetIfCorrectUsd != null && marketNetIfCorrectUsd >= 0 ? "var(--up)" : "var(--down)" }}>
                            {marketNetIfCorrectUsd != null ? formatUsd(marketNetIfCorrectUsd, 2) : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Break-even odds</p>
                          <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                            {marketBreakEvenPct != null ? `${marketBreakEvenPct.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-3)" }}>
                        Approximate preview only. Winning shares settle near $1.00, losing shares settle near $0.00.
                      </p>
                    </div>

                    {predictionTradeBlocked && (
                      <div
                        className="mt-3 rounded-xl border px-3 py-3"
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
                      className="mt-4 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        background: marketSide === "yes" ? "var(--accent-bags)" : "var(--down)",
                        color: "var(--bg-base)",
                        height: "36px",
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
                      className="mt-3 w-full py-2.5 rounded-md font-body font-medium text-[13px] transition-all duration-100 hover:brightness-110 flex items-center justify-center gap-2 border"
                      style={{ background: "var(--bg-surface)", color: "var(--text-2)", borderColor: "var(--border-subtle)" }}
                    >
                      Open market page
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div
                      className="mt-3 rounded-xl border px-3 py-3"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    >
                      {isKalshiMarketTrade ? (
                        <>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: proofVerified ? "var(--up)" : "var(--bags)" }}>
                            {proofVerified ? "Wallet verified" : "Wallet verification"}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                            {proofVerified
                              ? "Your wallet passed the DFlow Proof check. You can submit Kalshi orders from Siren."
                              : "Kalshi orders on DFlow need a one-time wallet verification before the first trade can go through."}
                          </p>
                          {!proofVerified && (
                            <button
                              type="button"
                              onClick={openDflowProofFlow}
                              className="mt-2 inline-flex items-center gap-2 text-xs font-medium"
                              style={{ color: "var(--accent)" }}
                            >
                              {dflowProofFetching ? "Checking wallet..." : "Verify wallet on DFlow"}
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
                            Polymarket trades use your Polygon wallet. Fund it with USDC on Polygon, or bridge from Solana.
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

                    <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-3)" }}>
                      {isPolymarketTrade
                        ? "Orders can take a few seconds while Siren signs, posts, and waits for the venue response."
                        : "Orders can take a few seconds to finish after your wallet confirms."}
                    </p>
                  </div>
                )}
                {buyPanelMode === "token" && selectedToken && (
                  <>
                  <div className="rounded-xl border p-4 md:p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">{isPredictionToken ? "Prediction position" : "Solana Token"}</p>
                    <div className="flex gap-2 mb-2">
                      {!isPredictionToken && (
                        <button
                          type="button"
                          onClick={() => setSellMode(false)}
                          className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${!sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                          style={!sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                        >
                          Buy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSellMode(true)}
                        className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                        style={sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        {isPredictionToken ? "Close" : "Sell"}
                      </button>
                    </div>
                    <p className="font-heading font-bold text-[var(--text-primary)]">{tokenDisplayName}</p>
                    <p className="font-body text-[var(--accent-primary)] text-sm mt-1 tabular-nums">
                      {tokenPriceFetchState === "loading"
                        ? "Fetching price..."
                        : selectedToken.price != null
                          ? `${isPredictionToken ? "Mark" : "~"} ${formatUsd(selectedToken.price, isPredictionToken ? 3 : 4)}`
                          : `Price unavailable${tokenPriceFetchReason ? `: ${tokenPriceFetchReason}` : ""}`}
                    </p>
                    {isPredictionToken ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedToken.marketSide && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{
                              background: selectedToken.marketSide === "yes" ? "var(--bags-dim)" : "var(--down-dim)",
                              color: selectedToken.marketSide === "yes" ? "var(--bags)" : "var(--down)",
                            }}
                          >
                            {selectedToken.marketSide.toUpperCase()}
                          </span>
                        )}
                        {selectedToken.marketTicker && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg-surface)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}>
                            {selectedToken.marketTicker}
                          </span>
                        )}
                        {selectedToken.marketProbability != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                            YES {selectedToken.marketProbability.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="font-body text-[var(--text-1)] mt-2 text-sm tabular-nums">
                        Vol 24h: {selectedToken.volume24h?.toLocaleString() ?? "-"} USD
                      </p>
                    )}
                    {!isPredictionToken && riskScore > 0 && (
                      <div
                        className="mt-3 rounded-lg border px-3 py-2"
                        style={{
                          background: riskScore >= 80
                            ? "color-mix(in srgb, var(--down) 12%, var(--bg-surface))"
                            : "color-mix(in srgb, var(--bags) 12%, var(--bg-surface))",
                          borderColor: riskScore >= 80
                            ? "color-mix(in srgb, var(--down) 30%, var(--border-subtle))"
                            : "color-mix(in srgb, var(--bags) 24%, var(--border-subtle))",
                        }}
                      >
                        <p className="font-body text-[10px] uppercase tracking-wide mb-1" style={{ color: riskScore >= 80 ? "var(--down)" : "var(--bags)" }}>
                          Risk trade analysed
                        </p>
                        <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
                          {riskLabel === "critical"
                            ? "This token is blocked because it looks like a honeypot or fake pair."
                            : "This token looks tradable, but it still carries elevated risk."}
                        </p>
                        {riskReasons.length > 0 && (
                          <p className="font-body text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
                            {riskReasons.join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {!isPredictionToken && (
                        <>
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                            MEV protected
                          </span>
                          <span className="text-[10px] text-[var(--text-3)]">Slippage:</span>
                          {[100, 200, 500].map((bps) => (
                            <button
                              key={bps}
                              type="button"
                              onClick={() => { hapticLight(); setSlippageBps(bps); }}
                              className={`text-[10px] font-body px-2 py-0.5 rounded transition-colors ${slippageBps === bps ? "bg-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg-surface)] text-[var(--text-2)] hover:text-[var(--text-1)]"}`}
                            >
                              {(bps / 100).toFixed(1)}%
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    {!sellMode ? (
                      <>
                        {isPredictionToken ? (
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
                              <label className="text-xs text-[var(--text-secondary)] block mb-1">USDC amount (enter for each buy)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="1"
                                placeholder="10.00"
                                value={solAmount}
                                onChange={(e) => setSolAmount(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg font-body text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                              />
                            </div>
                            <div className="mt-3 rounded-xl border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                              <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Buy preview</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Spend</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {tradeNotionalUsd != null ? formatUsd(tradeNotionalUsd, 2) : "—"}
                                  </p>
                                  <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                                    {parsedBuySolAmount != null ? `${formatTokenAmount(parsedBuySolAmount, 2)} USDC` : "Enter a USDC amount"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Estimated receive</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {tokenBuyApproxReceive != null ? `${formatTokenAmount(tokenBuyApproxReceive, 4)} ${tokenDisplaySymbol}` : "—"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Min receive @ slippage</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {tokenBuyMinReceive != null ? `${formatTokenAmount(tokenBuyMinReceive, 4)} ${tokenDisplaySymbol}` : "—"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Route</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--accent)" }}>
                                    {tokenRouteLabel}
                                  </p>
                                </div>
                              </div>
                              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-3)" }}>
                                Approximate preview from the latest token price. Siren buys from Solana USDC and builds the final quote at submit time.
                              </p>
                            </div>
                            <button
                              onClick={executeSwap}
                              disabled={loading || buyBlocked}
                              className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                              style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" /> Swapping…
                                </>
                              ) : buyBlocked ? (
                                "Blocked by risk analysis"
                              ) : (
                                `Buy ${tokenDisplayName}`
                              )}
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount of {tokenDisplayName} to sell</label>
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
                            {isPredictionToken ? "Payout preview" : "Sell preview"}
                          </p>
                          {isPredictionToken ? (
                            <div className="space-y-2">
                              <div className="flex justify-between gap-3 font-body text-sm" style={{ color: "var(--text-1)" }}>
                                <span style={{ color: "var(--text-3)" }}>Selling</span>
                                <span className="font-mono tabular-nums">
                                  {parsedSellTokenAmount != null ? `${formatTokenAmount(parsedSellTokenAmount, 2)} contracts` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-3 font-body text-sm" style={{ color: "var(--text-1)" }}>
                                <span style={{ color: "var(--text-3)" }}>Est. USDC (at mark)</span>
                                <span className="font-mono tabular-nums font-semibold" style={{ color: "var(--accent-bags)" }}>
                                  {tokenSellApproxUsd != null ? formatUsd(tokenSellApproxUsd, 2) : "—"}
                                </span>
                              </div>
                              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                                Mark is the live YES price. Final fill may differ slightly when the transaction lands.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Tokens in</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {parsedSellTokenAmount != null ? `${formatTokenAmount(parsedSellTokenAmount, 4)} ${tokenDisplaySymbol}` : "—"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Estimated receive</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {tokenSellApproxUsd != null ? `${formatTokenAmount(tokenSellApproxUsd, 2)} USDC` : "—"}
                                  </p>
                                  <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                                    {tokenSellApproxUsd != null ? formatUsd(tokenSellApproxUsd, 2) : "—"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Min receive @ slippage</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--text-1)" }}>
                                    {tokenSellMinReceiveUsd != null ? `${formatTokenAmount(tokenSellMinReceiveUsd, 2)} USDC` : "—"}
                                  </p>
                                </div>
                                <div className="rounded-lg border px-3 py-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Route</p>
                                  <p className="font-mono text-sm mt-1 tabular-nums" style={{ color: "var(--accent)" }}>
                                    {tokenRouteLabel}
                                  </p>
                                </div>
                              </div>
                              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-3)" }}>
                                Approximate preview from the latest token price. Final route quote is built at submit time.
                              </p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={executeSwap}
                          disabled={loading}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Selling...
                            </>
                          ) : (
                            isPredictionToken ? "Sell position for USDC" : `Sell ${tokenDisplayName} → USDC`
                          )}
                        </button>
                      </>
                    )}
                    <div className="mt-3 md:mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-3)] mb-1">{isPredictionToken ? (sellMode ? "Note" : "Marking guide") : "24h price sketch"}</p>
                      {isPredictionToken ? (
                        sellMode ? (
                          <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                            You are closing part or all of this position. USDC returns to your Solana wallet after confirmation.
                          </p>
                        ) : (
                        <div className="rounded-lg border px-3 py-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                          <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                            Add size from the market panel. Prices follow live YES probability; closes route back to USDC on Solana.
                          </p>
                        </div>
                        )
                      )
                      : (
                        <div className="h-20 md:h-28 rounded-lg overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_CHART_DATA}>
                              <defs>
                                <linearGradient id="priceGradPanel" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#00FF85" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#00FF85" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="v" stroke="#00FF85" strokeWidth={2} fill="url(#priceGradPanel)" />
                              <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="var(--text-3)" />
                              <YAxis hide domain={["dataMin", "dataMax"]} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {!isPredictionToken && <CopyCAButton mint={selectedToken.mint} />}
                    </div>
                  </div>
                  {!(isPredictionToken && sellMode) && (
                  <div className="rounded-xl border p-4 flex flex-col" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-3">{isPredictionToken ? "Position info" : "Token info"}</p>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">{isPredictionToken ? "Mark price" : "Price (est.)"}</span>
                        <span className="font-body text-[var(--accent-primary)] tabular-nums">
                          {selectedToken.price != null ? `$${selectedToken.price.toFixed(6)}` : "—"}
                        </span>
                      </p>
                      {isPredictionToken ? (
                        <>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Side</span>
                            <span className="font-body text-[var(--text-2)]">{selectedToken.marketSide?.toUpperCase() ?? "—"}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Market</span>
                            <span className="font-body text-[var(--text-2)] truncate pl-4" title={selectedToken.marketTitle ?? selectedMarket?.title}>
                              {selectedToken.marketTicker ?? selectedMarket?.ticker ?? "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Reference YES</span>
                            <span className="font-body text-[var(--accent-bags)] tabular-nums">
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
                        </>
                      ) : (
                        <>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">24h volume</span>
                            <span className="font-body text-[var(--accent-bags)] tabular-nums">
                              {selectedToken.volume24h != null ? `${selectedToken.volume24h.toLocaleString()} USD` : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Liquidity</span>
                            <span className="font-body text-[var(--text-2)] tabular-nums">
                              {selectedToken.liquidityUsd != null ? `$${formatCompactNumber(selectedToken.liquidityUsd)}` : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">FDV</span>
                            <span className="font-body text-[var(--text-2)] tabular-nums">
                              {selectedToken.fdvUsd != null ? `$${formatCompactNumber(selectedToken.fdvUsd)}` : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Holders</span>
                            <span className="font-body text-[var(--text-2)] tabular-nums">
                              {selectedToken.holders != null ? formatCompactNumber(selectedToken.holders, 0) : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Curve</span>
                            <span className="text-[var(--text-2)]">
                              {selectedToken.bondingCurveStatus === "bonded"
                                ? "Bonded"
                                : selectedToken.bondingCurveStatus === "bonding"
                                  ? "On curve"
                                  : "—"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-[var(--text-3)]">Rugcheck</span>
                            <span style={{ color: selectedToken.safe === false ? "var(--down)" : "var(--bags)" }}>
                              {selectedToken.rugcheckScore != null
                                ? `${selectedToken.rugcheckScore}${selectedToken.safe === false ? " · watch" : ""}`
                                : selectedToken.safe === false
                                  ? "Watch"
                                  : "Safe"}
                            </span>
                          </p>
                        </>
                      )}
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">{isPredictionToken ? "Reference" : "Swap"}</span>
                        <span className="text-[var(--text-2)]">{isPredictionToken ? "Kalshi / DFlow" : "DFlow / Jupiter"}</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-3)] mt-3 leading-relaxed">
                      {isPredictionToken
                        ? "Prediction positions are marked from live market probability and closed through DFlow outcome-token routing."
                        : "Chart is illustrative. Execute swaps via Jupiter; confirm in your wallet."}
                    </p>
                  </div>
                  )}
                  {!isPredictionToken && (
                    <>
                      <TokenSignalSection
                        volume24h={selectedToken.volume24h}
                        matchedMarketTitle={selectedMarket?.title}
                      />
                      <TokenTweetsSection mint={selectedToken.mint} />
                    </>
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
                  Verify wallet on DFlow
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {!resultModalOpen && success && <p className="text-sm mt-3" style={{ color: "var(--accent-bags)" }}>{success}</p>}
              <p className="text-[var(--text-secondary)] text-[11px] mt-3 leading-relaxed">
                Use market mode for YES or NO shares and token mode for linked coins. Siren spends USDC for both Solana and Polymarket trades, and Kalshi may need a one-time DFlow wallet verification first.
              </p>
            </div>
          </motion.div>
        </>
      )}
      {tradePnLModalOpen && tradePnLData && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => {
            hapticLight();
            setTradePnLModalOpen(false);
            setTradePnLData(null);
          }}
        >
          <div
            className="w-full max-w-[460px]"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: "20px",
            }}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setTradePnLModalOpen(false);
                  setTradePnLData(null);
                }}
                className="px-3 py-2 rounded-lg font-body text-xs font-medium"
                style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
                aria-label="Close PnL card"
              >
                Close
              </button>
            </div>
            <TradePnLCard
              token={tradePnLData.token}
              profitUsd={tradePnLData.profitUsd}
              percent={tradePnLData.percent}
              kalshiMarket={tradePnLData.kalshiMarket}
              wallet={tradePnLData.wallet}
              displayName={cardDisplayName}
              executedAt={tradePnLData.executedAt}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
