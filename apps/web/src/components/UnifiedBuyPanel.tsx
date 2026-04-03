"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Copy, Check, Loader2, ExternalLink, ChevronDown, ChevronUp, X } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { ResultModal } from "./ResultModal";
import { TradePnLCard, type TradePnLToken } from "./TradePnLCard";
import { useToastStore } from "@/store/useToastStore";
import { hapticLight } from "@/lib/haptics";

import { API_URL } from "@/lib/apiUrl";
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1e9;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const { selectedMarket, selectedToken, buyPanelOpen, buyPanelMode, setBuyPanelOpen, setSelectedMarket, setSelectedToken, openForSell } =
    useSirenStore();
  const { connected, publicKey, signTransaction, walletSessionStatus } = useSirenWallet();
  const { connection } = useConnection();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetch(`${API_URL}/api/sol-price`, { credentials: "omit" }).then((r) => r.json()).then((j) => j.usd ?? 0),
    staleTime: 60_000,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; title: string; message: string; txSignature?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [solAmount, setSolAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellMode, setSellMode] = useState(false);
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

  const tokenDisplayName =
    selectedToken?.name && selectedToken.name !== "-" && selectedToken.name !== "Unknown" ? selectedToken.name : selectedToken?.symbol ?? "";
  const tokenDisplaySymbol =
    selectedToken?.symbol && selectedToken.symbol !== "-" && selectedToken.symbol !== "—" ? selectedToken.symbol : selectedToken?.name ?? "";

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selectedToken) return;
      // Fetch price/name on-demand if we don't have a usable USD price yet.
      const needsPrice = selectedToken.price == null || !Number.isFinite(selectedToken.price);
      const needsNameOrSymbol =
        !selectedToken.name || selectedToken.name === "Unknown" || selectedToken.name === "-" || !selectedToken.symbol || selectedToken.symbol === "-" || selectedToken.symbol === "—";
      if (!needsPrice && !needsNameOrSymbol) return;
      setTokenPriceFetchState("loading");
      setTokenPriceFetchReason(null);
      try {
        const apiUrl = API_URL;
        const res = await fetch(`${apiUrl}/api/token-info?mint=${encodeURIComponent(selectedToken.mint)}`, { credentials: "omit" });
        const j = await res.json();
        if (!res.ok || !j?.data) {
          throw new Error(j?.error || "Token info unavailable");
        }
        const d = j.data as { name?: string; symbol?: string; priceUsd?: number };
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
    setResultModal(null);
    setTradePnLModalOpen(false);
    setTradePnLData(null);
  };
  const buyBlocked = !!selectedToken?.riskBlocked && !sellMode;
  const riskScore = selectedToken?.riskScore ?? 0;
  const riskReasons = selectedToken?.riskReasons ?? [];
  const riskLabel = selectedToken?.riskLabel ?? "low";

  const executeSwap = async () => {
    hapticLight();
    if (walletSessionStatus !== "ready") {
      if (walletSessionStatus === "needs-privy-login") {
        setError("Sign in to trade. Use Sign up in the header or open the onboarding page.");
        return;
      }
      setError(
        walletSessionStatus === "privy-loading"
          ? "Wallet is still initializing. Please wait a moment and try again."
          : "Your embedded Solana wallet is still being set up. Please wait and try again."
      );
      return;
    }
    if (!connected || !publicKey || !selectedToken || !signTransaction) {
      setError("Connect your wallet to execute trades.");
      return;
    }
    if (!sellMode && selectedToken.riskBlocked) {
      const reason = riskReasons[0] ?? "This token looks too risky to trade.";
      const msg = `Risk trade analysed. ${reason}.`;
      setError(msg);
      setResultModal({ type: "error", title: "Trade blocked", message: msg });
      addToast(msg, "error");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const isSell = !!sellMode;
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
        outputMint = NATIVE_SOL_MINT;
      } else {
        const amountStr = solAmount?.trim() || "";
        amountNum = parseFloat(amountStr);
        if (!amountStr || amountNum <= 0 || !Number.isFinite(amountNum)) {
          setError("Enter a valid SOL amount (e.g. 0.01).");
          setLoading(false);
          return;
        }
        amount = String(Math.floor(amountNum * LAMPORTS_PER_SOL));
        inputMint = NATIVE_SOL_MINT;
        outputMint = selectedToken.mint;
      }

      const tokenPriceUsd = typeof selectedToken.price === "number" && Number.isFinite(selectedToken.price) ? selectedToken.price : null;
      const tokenNameToLog = tokenDisplayName || selectedToken.name;
      const tokenSymbolToLog = tokenDisplaySymbol || selectedToken.symbol;

      // For the Trade PnL card (buy flows)
      let tokenAmountForPnL: number | null = null;
      let boughtUsdForPnL: number | null = null;
      if (!isSell && tokenPriceUsd != null && tokenPriceUsd > 0 && solPriceUsd > 0 && Number.isFinite(amountNum)) {
        boughtUsdForPnL = amountNum * solPriceUsd;
        tokenAmountForPnL = (amountNum * solPriceUsd) / tokenPriceUsd;
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

      // Track per-wallet volume and trades for Siren (local, in SOL terms)
      try {
        if (typeof window !== "undefined") {
          let volumeSol: number | null = null;
          let tokenAmountApprox: number | null = null;

          // Approximate SOL volume + token amount (used by our local PnL calc)
          if (isSell) {
            if (tokenPriceUsd != null && tokenPriceUsd > 0 && solPriceUsd > 0) {
              tokenAmountApprox = amountNum;
              const approxSolPerToken = tokenPriceUsd / solPriceUsd;
              volumeSol = amountNum * approxSolPerToken;
            }
          } else {
            volumeSol = amountNum;
            if (tokenPriceUsd != null && tokenPriceUsd > 0 && solPriceUsd > 0) {
              tokenAmountApprox = (amountNum * solPriceUsd) / tokenPriceUsd;
            }
          }

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
              mint: selectedToken.mint,
              side: isSell ? "sell" : "buy",
              volumeSol,
            });
            // Keep only the most recent 500 entries to bound storage
            if (entries.length > 500) {
              entries = entries.slice(entries.length - 500);
            }
            window.localStorage.setItem(key, JSON.stringify(entries));

            // Also log to API for admin volume stats
            const apiUrl = API_URL;
            fetch(`${apiUrl}/api/volume/log`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol }),
            }).catch(() => {});
          }

          // Trade log for PnL / detailed stats (local)
          if (
            tokenAmountApprox != null &&
            tokenAmountApprox > 0 &&
            tokenPriceUsd != null &&
            tokenPriceUsd > 0 &&
            volumeSol != null
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
              mint: selectedToken.mint,
              side: isSell ? "sell" : "buy",
              solAmount: volumeSol ?? 0,
              tokenAmount: tokenAmountApprox,
              priceUsd: tokenPriceUsd,
            });
            if (trades.length > 1000) {
              trades = trades.slice(trades.length - 1000);
            }
            window.localStorage.setItem(tradesKey, JSON.stringify(trades));
          }

          // Trade log (permanent) for future on-chain PnL/open positions
          // Note: requires a Supabase table to exist (see docs).
          try {
            const tokenAmountForLog = isSell ? amountNum : tokenAmountApprox ?? null;
            const apiUrl = API_URL;
            fetch(`${apiUrl}/api/trades/log`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                wallet: publicKey.toBase58(),
                mint: selectedToken.mint,
                side: isSell ? "sell" : "buy",
                tokenAmount: tokenAmountForLog,
                priceUsd: tokenPriceUsd,
                tokenName: tokenNameToLog,
                tokenSymbol: tokenSymbolToLog,
                txSignature: sig,
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore volume tracking errors
      }

      // Show screenshot-matching Trade PnL card after successful BUY (for quick testing).
      if (!isSell && tokenAmountForPnL != null && boughtUsdForPnL != null && tokenAmountForPnL > 0 && boughtUsdForPnL > 0) {
        try {
          const apiUrl = API_URL;
          const res = await fetch(`${apiUrl}/api/token-info?mint=${encodeURIComponent(selectedToken.mint)}`, { credentials: "omit" });
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
          setResultModal(null);
          setSuccess(null);
          return;
        } catch {
          // If price fetch fails, still show regular success UI.
        }
      }

      setSuccess(isSell ? `Sold! ${tokenDisplayName || selectedToken.name} Tx: ${sig.slice(0, 8)}...` : `Swap successful! ${sig.slice(0, 8)}...`);
      if (isSell) setSellAmount("");
      queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      setResultModal({
        type: "success",
        title: "Swap complete",
        message: isSell
          ? `Sold ${tokenDisplayName || selectedToken.name} (${amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens).`
          : `Swap successful.`,
        txSignature: sig,
      });
    } catch (e) {
      console.error("[Siren] executeSwap failed", e);
      const msg = e instanceof Error ? e.message : "Swap failed";
      const lower = msg.toLowerCase();
      let friendly = "Swap failed. Please try again.";
      if (msg.includes("0x1771") || lower.includes("slippage")) {
        friendly = "Price moved. Try a smaller amount.";
      } else if (lower.includes("simulation failed") || lower.includes("custom program error")) {
        friendly = "Transaction simulation failed. Try a smaller amount or higher slippage.";
      } else if (lower.includes("insufficient")) {
        friendly = "Insufficient balance for this trade.";
      }
      setError(friendly);
      setResultModal({ type: "error", title: "Swap failed", message: friendly });
      addToast(friendly, "error");
    } finally {
      setLoading(false);
    }
  };

  const onBuyKalshi = () => {
    setError(null);
    window.open(selectedMarket?.kalshi_url || "https://kalshi.com", "_blank");
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
              boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider" style={{ color: "var(--accent)" }}>Trade</h3>
              <button type="button" onClick={onClose} className="p-2 -m-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: "var(--text-3)" }} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {buyPanelMode === "token" && selectedToken && walletSessionStatus !== "ready" && (
                <div
                  className="mb-3 rounded-lg border px-3 py-2.5 font-body text-xs"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))",
                    color: "var(--text-2)",
                  }}
                >
                  {walletSessionStatus === "needs-privy-login"
                    ? "Sign in to trade (header: Sign up, or /onboarding)."
                    : walletSessionStatus === "privy-loading"
                      ? "Connecting your wallet session…"
                      : "Creating your embedded Solana wallet…"}
                </div>
              )}
              <div className="flex flex-col gap-4">
                {buyPanelMode === "market" && selectedMarket && (
                  <div className="rounded-lg border p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Prediction market</p>
                    <p className="font-heading font-bold text-[var(--text-primary)] text-sm line-clamp-2">{selectedMarket.title}</p>
                    <p className="font-body text-[var(--accent-kalshi)] mt-2">{selectedMarket.probability.toFixed(0)}% YES</p>
                    <p className="text-[var(--text-secondary)] text-xs mt-2 mb-3">Market trading is on Kalshi. Use the link below to trade.</p>
                    <a
                      href={selectedMarket.kalshi_url || "https://kalshi.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 flex items-center justify-center gap-2"
                      style={{ background: "var(--accent-kalshi)", color: "var(--bg-base)", height: "36px" }}
                    >
                      Trade on Kalshi
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
                {buyPanelMode === "token" && selectedToken && (
                  <>
                  <div className="rounded-xl border p-4 md:p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Solana Token</p>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setSellMode(false)}
                        className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${!sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                        style={!sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => setSellMode(true)}
                        className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors duration-100 ${sellMode ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                        style={sellMode ? { background: "var(--accent-bags)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        Sell
                      </button>
                    </div>
                    <p className="font-heading font-bold text-[var(--text-primary)]">{tokenDisplayName}</p>
                    <p className="font-body text-[var(--accent-primary)] text-sm mt-1 tabular-nums">
                      {tokenPriceFetchState === "loading" ? "Fetching price..." : selectedToken.price != null ? `~$${selectedToken.price.toFixed(4)} USD` : `Price unavailable${tokenPriceFetchReason ? `: ${tokenPriceFetchReason}` : ""}`}
                    </p>
                    <p className="font-body text-[var(--text-1)] mt-2 text-sm tabular-nums">
                      Vol 24h: {selectedToken.volume24h?.toLocaleString() ?? "-"} USD
                    </p>
                    {riskScore > 0 && (
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
                    <div className="flex items-center gap-2 mt-2">
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
                    </div>
                    {!sellMode ? (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">SOL amount (enter for each buy)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="0.01"
                            value={solAmount}
                            onChange={(e) => setSolAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg font-body text-sm text-[var(--text-primary)] border transition-colors focus:border-[var(--border-active)] focus:outline-none"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <button
                          onClick={executeSwap}
                          disabled={loading || buyBlocked || walletSessionStatus !== "ready"}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Swapping…
                            </>
                          ) : walletSessionStatus !== "ready" ? (
                            walletSessionStatus === "needs-privy-login"
                              ? "Sign in to trade"
                              : walletSessionStatus === "privy-loading"
                                ? "Wallet initializing…"
                                : "Wallet provisioning…"
                          ) : buyBlocked ? (
                            "Blocked by risk analysis"
                          ) : (
                            `Buy ${tokenDisplayName}`
                          )}
                        </button>
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
                        <button
                          onClick={executeSwap}
                          disabled={loading || walletSessionStatus !== "ready"}
                          className="mt-3 w-full py-2.5 rounded-md font-heading font-bold text-[13px] uppercase tracking-[0.08em] transition-all duration-100 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: "var(--accent-bags)", color: "var(--bg-base)", height: "36px" }}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Selling...
                            </>
                          ) : walletSessionStatus !== "ready" ? (
                            walletSessionStatus === "needs-privy-login"
                              ? "Sign in to trade"
                              : walletSessionStatus === "privy-loading"
                                ? "Wallet initializing…"
                                : "Wallet provisioning…"
                          ) : (
                            `Sell ${tokenDisplayName} → SOL`
                          )}
                        </button>
                      </>
                    )}
                    <div className="mt-3 md:mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-3)] mb-1">24h price sketch</p>
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
                      <CopyCAButton mint={selectedToken.mint} />
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 flex flex-col" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03)" }}>
                    <p className="text-[var(--text-secondary)] text-xs uppercase mb-3">Token info</p>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">Price (est.)</span>
                        <span className="font-body text-[var(--accent-primary)] tabular-nums">
                          {selectedToken.price != null ? `$${selectedToken.price.toFixed(6)}` : "—"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">24h volume</span>
                        <span className="font-body text-[var(--accent-bags)] tabular-nums">
                          {selectedToken.volume24h != null ? `${selectedToken.volume24h.toLocaleString()} USD` : "—"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-[var(--text-3)]">Swap</span>
                        <span className="text-[var(--text-2)]">DFlow / Jupiter</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-3)] mt-3 leading-relaxed">
                      Chart is illustrative. Execute swaps via Jupiter; confirm in your wallet.
                    </p>
                  </div>
                  <TokenSignalSection
                        volume24h={selectedToken.volume24h}
                        matchedMarketTitle={selectedMarket?.title}
                      />
                  <TokenTweetsSection mint={selectedToken.mint} />
                  </>
                )}
              </div>
              {!resultModal && error && <p className="text-sm mt-3" style={{ color: "var(--down)" }}>{error}</p>}
              {!resultModal && success && <p className="text-sm mt-3" style={{ color: "var(--accent-bags)" }}>{success}</p>}
              <p className="text-[var(--text-secondary)] text-[11px] mt-3 leading-relaxed">Connect wallet. Markets: Kalshi. Swaps: DFlow (market tokens) or Jupiter (fallback). MEV protected.</p>
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
              executedAt={tradePnLData.executedAt}
            />
          </div>
        </div>
      )}
      {resultModal && (
        <ResultModal
          key="result-modal"
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          txSignature={resultModal.txSignature}
          onClose={() => setResultModal(null)}
        />
      )}
    </AnimatePresence>
  );
}
