"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import Link from "next/link";
import {
  Shield, Loader2, ArrowLeft, Copy, Check,
  ChevronDown, ArrowUp, CreditCard, Pencil, ArrowRightLeft, RefreshCw, Share2, Settings,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useToastStore } from "@/store/useToastStore";
import { useResultModalStore } from "@/store/useResultModalStore";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import { fetchSolPriceUsd } from "@/lib/pricing";
import { useFundWallet as useSolanaFundWallet } from "@privy-io/react-auth/solana";
import { buildSolanaFundingConfig } from "@/lib/privyFunding";
import {
  buildProofDeepLink, buildProofMessage,
  buildProofRedirectUri, encodeProofSignature,
} from "@/lib/dflowProof";
import { API_URL } from "@/lib/apiUrl";
import { useGoldRushWalletIntelligence } from "@/hooks/useGoldRushWalletIntelligence";
import { useTorqueRelayReadiness } from "@/hooks/useTorqueRelayReadiness";
import { TradePnLCard } from "@/components/TradePnLCard";
import {
  getPositionEntry,
  setPositionEntry,
  pnlFromAvgEntry,
  markCentsForSide,
} from "@/lib/positionEntryStorage";
import { pushLocalTrade, readLocalTrades, type LocalTradeLedgerRow } from "@/lib/localTradeLedger";

const LAMPORTS_PER_SOL = 1e9;
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

interface Position {
  ticker: string;
  title: string;
  side: string;
  probability?: number;
  entryPrice?: number;
  currentPrice?: number;
  quantity?: number;
  balance?: number;
  pnlUsd?: number;
  pnlPct?: number;
  status?: string;
  mint?: string;
  kalshi_url?: string;
  yesBid?: string;
  yesAsk?: string;
  currentPriceUsd?: number;
  marketValueUsd?: number;
}

interface TradeAttemptFeedRow {
  venue: string;
  mode: string;
  market: string | null;
  side: string | null;
  inputAsset: string | null;
  outputAsset: string | null;
  amount: string | null;
  status: string;
  txSignature: string | null;
  errorMessage: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface TradeAttemptFeedData {
  rows: TradeAttemptFeedRow[];
  summary: {
    attempts: number;
    successCount: number;
    failedCount: number;
    partialCount: number;
    successRate: number;
  };
}

type RiskCluster = {
  label: string;
  positions: Position[];
  exposureUsd: number;
  pnlUsd: number;
};

function computePositionPnl(p: Position): { usd: number; pct: number } {
  const shares = p.quantity ?? p.balance ?? 0;
  const entry = p.mint ? getPositionEntry(p.mint) : null;
  if (entry && shares > 0) {
    const { pnlUsd, pnlPct } = pnlFromAvgEntry({
      side: p.side,
      probability: p.probability,
      shares,
      avgCents: entry.avgCents,
    });
    return { usd: pnlUsd, pct: pnlPct };
  }
  return { usd: p.pnlUsd ?? 0, pct: p.pnlPct ?? 0 };
}

function positionMarketValueUsd(position: Position): number {
  if (typeof position.marketValueUsd === "number" && Number.isFinite(position.marketValueUsd)) {
    return position.marketValueUsd;
  }
  const shares = position.quantity ?? position.balance ?? 0;
  const cents = position.currentPrice ?? position.probability ?? 0;
  return shares * (cents / 100);
}

const RISK_THEME_PATTERNS: Array<{ label: string; match: RegExp }> = [
  { label: "Bitcoin", match: /\bbtc\b|\bbitcoin\b/ },
  { label: "Ethereum", match: /\beth\b|\bethereum\b/ },
  { label: "Solana", match: /\bsol\b|\bsolana\b/ },
  { label: "Trump", match: /\btrump\b/ },
  { label: "Election", match: /\belection\b|\bvote\b|\bpresident\b/ },
  { label: "Federal Reserve", match: /\bfed\b|\brate cut\b|\bpowell\b|\binterest rate\b/ },
  { label: "Inflation", match: /\bcpi\b|\binflation\b/ },
  { label: "NBA", match: /\bnba\b|\bplayoffs\b|\bfinals\b/ },
  { label: "NFL", match: /\bnfl\b|\bsuper bowl\b/ },
];

function inferRiskTags(position: Position): string[] {
  const haystack = `${position.title} ${position.ticker}`.toLowerCase();
  const matches = RISK_THEME_PATTERNS
    .filter((item) => item.match.test(haystack))
    .map((item) => item.label);

  if (matches.length > 0) return matches;

  const fallback = position.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["will", "with", "that", "this", "from", "into", "over", "under"].includes(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return fallback.length > 0 ? [fallback.join(" ")] : [];
}

function bucketFailureReason(message?: string | null): string {
  const lower = message?.toLowerCase().trim() ?? "";
  if (!lower) return "Unknown";
  if (lower.includes("insufficient")) return "Insufficient balance";
  if (lower.includes("verify") || lower.includes("proof") || lower.includes("jurisdiction")) return "Verification";
  if (lower.includes("route")) return "No route";
  if (lower.includes("thin") || lower.includes("depth") || lower.includes("partial")) return "Thin liquidity";
  if (lower.includes("slippage") || lower.includes("price")) return "Price moved";
  return "Other";
}

function readNumericMetadata(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatAttemptAmount(row: TradeAttemptFeedRow): string {
  const parsed = row.amount != null ? Number.parseFloat(row.amount) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return "—";

  if (row.mode === "buy-market") {
    return `$${fmtUsd(parsed)} ${row.inputAsset ?? "USDC"}`;
  }

  if (row.mode === "sell" || row.side === "sell") {
    return `${fmtToken(parsed, 2)} contracts`;
  }

  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.inputAsset ?? ""}`.trim();
}

function buildTradeAttemptNarrative(row: TradeAttemptFeedRow): {
  title: string;
  advice: string;
  result: string;
  risk: string | null;
} {
  const metadata = row.metadata ?? {};
  const suggestedClipUsd = readNumericMetadata(metadata, "suggestedClipUsd");
  const suggestedChunkContracts = readNumericMetadata(metadata, "suggestedChunkContracts");
  const selectedOutcome =
    typeof metadata.selectedOutcome === "string" && metadata.selectedOutcome.trim()
      ? metadata.selectedOutcome.trim()
      : null;
  const resolutionRisk =
    typeof metadata.resolutionRisk === "string" && metadata.resolutionRisk.trim()
      ? metadata.resolutionRisk.trim()
      : null;
  const fieldRisk =
    typeof metadata.fieldRisk === "string" && metadata.fieldRisk.trim()
      ? metadata.fieldRisk.trim()
      : null;
  const partialSellFilled = metadata.partialSellFilled === true;

  const chunkPlan = metadata.chunkPlan;
  const estimatedChunks =
    chunkPlan && typeof chunkPlan === "object" && !Array.isArray(chunkPlan) && typeof (chunkPlan as { estimatedChunks?: unknown }).estimatedChunks === "number"
      ? (chunkPlan as { estimatedChunks: number }).estimatedChunks
      : null;

  const title =
    selectedOutcome
      ? `${row.market || "Market"} · ${selectedOutcome}`
      : row.market || row.outputAsset || row.inputAsset || "Execution attempt";

  const advice =
    suggestedClipUsd != null
      ? `Siren advised starting around $${fmtUsd(suggestedClipUsd)}.`
      : suggestedChunkContracts != null
        ? `Siren advised chunks of about ${fmtToken(suggestedChunkContracts, 2)} contracts.`
        : "No stored Siren sizing advice for this attempt.";

  const result = row.errorMessage
    ? bucketFailureReason(row.errorMessage)
    : partialSellFilled
      ? "Partial fill captured after adaptive chunking."
      : estimatedChunks && estimatedChunks > 1
        ? `Route was expected to work in about ${estimatedChunks} chunks.`
        : "Route completed cleanly.";

  const risk = [resolutionRisk, fieldRisk].filter(Boolean).join(" · ") || null;

  return { title, advice, result, risk };
}

const fmtUsd = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtToken = (n: number, d = 4) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });

const pnlColor = (n: number) =>
  n > 0 ? "var(--up)" : n < 0 ? "var(--down)" : "var(--text-3)";

// ── Withdraw Modal ──────────────────────────────────────────────────

function WithdrawModal({ solBalance, solPrice, onClose }: {
  solBalance: number; solPrice: number; onClose: () => void;
}) {
  const { publicKey, signTransaction } = useSirenWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const showResultModal = useResultModalStore((s) => s.show);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const amt = parseFloat(amount) || 0;
  const usdEst = amt > 0 ? amt * solPrice : 0;

  const handleSend = async () => {
    if (!publicKey || !signTransaction) return;
    if (!recipient.trim() || amt <= 0) {
      showResultModal({ type: "error", title: "Send SOL", message: "Enter a valid recipient address and amount." });
      return;
    }
    if (amt > solBalance) {
      showResultModal({
        type: "error",
        title: "Insufficient SOL",
        message: `You have ${solBalance.toFixed(4)} SOL available.`,
      });
      return;
    }

    let toPubkey: PublicKey;
    try { toPubkey = new PublicKey(recipient.trim()); }
    catch {
      showResultModal({ type: "error", title: "Invalid address", message: "That does not look like a valid Solana address." });
      return;
    }

    setSending(true);
    try {
      const lamports = BigInt(Math.floor(amt * LAMPORTS_PER_SOL));
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey, lamports }),
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");
      showResultModal({
        type: "success",
        title: "SOL sent",
        message: `Sent ${amt} SOL from your wallet.`,
        txSignature: sig,
      });
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
      onClose();
    } catch (err) {
      showResultModal({
        type: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Could not complete the transfer.",
      });
    } finally { setSending(false); }
  };

  const inputStyle = { background: "var(--bg-base)", borderColor: "var(--border-subtle)", color: "var(--text-1)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-xl border p-5"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <h3 className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
          Send SOL
        </h3>
        <label className="mt-4 block font-sub text-xs" style={{ color: "var(--text-3)" }}>
          Recipient address
        </label>
        <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
          placeholder="Solana address…"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-label text-sm outline-none"
          style={inputStyle} />
        <label className="mt-3 block font-sub text-xs" style={{ color: "var(--text-3)" }}>
          Amount (SOL)
        </label>
        <input type="number" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min={0} step="any"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-money tabular-nums text-sm outline-none"
          style={inputStyle} />
        <div className="mt-1 flex items-center justify-between font-sub text-[11px]"
          style={{ color: "var(--text-3)" }}>
          <span>Available: {fmtToken(solBalance)} SOL</span>
          {usdEst > 0 && <span>≈ ${fmtUsd(usdEst)}</span>}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={handleSend} disabled={sending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-heading text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send
          </button>
          <button type="button" onClick={onClose}
            className="rounded-lg border px-4 py-2.5 font-body text-sm"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositModal({
  walletKey,
  onClose,
  onFund,
  addressCopied,
  onCopyAddress,
  loading,
}: {
  walletKey: string;
  onClose: () => void;
  onFund: () => Promise<void> | void;
  addressCopied: boolean;
  onCopyAddress: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-5"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <h3 className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
          Deposit
        </h3>
        <p className="mt-1 font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
          Add USDC with card or Apple Pay, or send crypto from another wallet.
        </p>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onFund}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-50"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
          >
            <div>
              <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                Buy with card
              </p>
              <p className="mt-0.5 font-body text-xs" style={{ color: "var(--text-3)" }}>
                Apple Pay may appear when supported by Privy.
              </p>
            </div>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} /> : <CreditCard className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          </button>

          <div
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
          >
            <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Transfer from another wallet
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Send SOL or Solana USDC to this address.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all font-label text-[10px]" style={{ color: "var(--text-1)" }}>
                {walletKey}
              </code>
              <button
                type="button"
                onClick={onCopyAddress}
                className="shrink-0 rounded-md p-1 hover:bg-[var(--bg-elevated)]"
                style={{ color: "var(--text-2)" }}
                aria-label="Copy wallet address"
              >
                {addressCopied ? <Check className="h-3 w-3" style={{ color: "var(--up)" }} /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border py-2.5 font-body text-sm"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Swap Panel ──────────────────────────────────────────────────────

const SWAP_TOKENS = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
];

const MINT_SYMBOL: Record<string, string> = Object.fromEntries(SWAP_TOKENS.map((t) => [t.mint, t.symbol]));

function symbolForMint(mint: string): string {
  return MINT_SYMBOL[mint] ?? `${mint.slice(0, 4)}…`;
}

function formatActivitySummary(row: LocalTradeLedgerRow): string {
  const sym = symbolForMint(row.mint);
  if (row.side === "sell") {
    return `Sold · ${fmtToken(row.tokenAmount, row.tokenAmount >= 1 ? 2 : 4)} ${sym}`;
  }
  if (row.stakeUsd != null && row.stakeUsd > 0) {
    return `Prediction · $${fmtUsd(row.stakeUsd)} → ~${fmtToken(row.tokenAmount, 2)} shares (${sym})`;
  }
  if (row.solAmount > 0) {
    return `Swapped · ${fmtToken(row.solAmount, 4)} SOL → ~${fmtToken(row.tokenAmount, 2)} ${sym}`;
  }
  return `Bought · ~${fmtToken(row.tokenAmount, 4)} ${sym}`;
}

function formatActivityTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function SwapPanel({ onActivityLogged }: { onActivityLogged?: () => void }) {
  const { publicKey, signTransaction } = useSirenWallet();
  const queryClient = useQueryClient();
  const showResultModal = useResultModalStore((s) => s.show);

  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<{ outAmount: string; requestId?: string } | null>(null);
  const [quoting, setQuoting] = useState(false);

  const fromToken = SWAP_TOKENS[fromIdx];
  const toToken = SWAP_TOKENS[toIdx];

  const flipTokens = useCallback(() => {
    hapticLight();
    setFromIdx(toIdx);
    setToIdx(fromIdx);
    setQuoteData(null);
  }, [fromIdx, toIdx]);

  const fetchQuote = useCallback(async (inputAmount: string) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) { setQuoteData(null); return; }
    setQuoting(true);
    try {
      const lamports = Math.floor(parseFloat(inputAmount) * 10 ** fromToken.decimals);
      const params = new URLSearchParams({
        inputMint: fromToken.mint,
        outputMint: toToken.mint,
        amount: String(lamports),
        slippageBps: "50",
      });
      const res = await fetch(`${API_URL}/api/swap/order?${params.toString()}`, { credentials: "omit" });
      if (!res.ok) throw new Error("Quote failed");
      const data = await res.json();
      setQuoteData({ outAmount: data.outAmount, requestId: data.requestId });
    } catch {
      setQuoteData(null);
    } finally {
      setQuoting(false);
    }
  }, [fromToken, toToken]);

  const executeSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !amount) return;
    setLoading(true);
    try {
      const lamports = Math.floor(parseFloat(amount) * 10 ** fromToken.decimals);
      const params = new URLSearchParams({
        inputMint: fromToken.mint,
        outputMint: toToken.mint,
        amount: String(lamports),
        taker: publicKey.toBase58(),
        slippageBps: "50",
      });
      const orderRes = await fetch(`${API_URL}/api/swap/order?${params.toString()}`, { credentials: "omit" });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        const msg =
          typeof order?.error === "string" && order.error.trim()
            ? order.error
            : `Order failed (${orderRes.status}).`;
        throw new Error(msg);
      }
      if (!order.transaction) throw new Error("No transaction returned");

      const txBuf = Buffer.from(order.transaction, "base64");
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx as unknown as Transaction);
      const signedBase64 = Buffer.from((signed as unknown as VersionedTransaction).serialize()).toString("base64");

      const execRes = await fetch(`${API_URL}/api/swap/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransaction: signedBase64, requestId: order.requestId }),
      });
      const result = await execRes.json();
      if (result.status !== "Success") throw new Error(result.error || "Swap failed on-chain");

      fetch(`${API_URL}/api/volume/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol: parseFloat(amount) }),
      }).catch(() => {});

      const outUi =
        quoteData && quoteData.outAmount
          ? parseInt(quoteData.outAmount, 10) / 10 ** toToken.decimals
          : 0;
      const amtNum = parseFloat(amount) || 0;
      pushLocalTrade(publicKey.toBase58(), {
        ts: Date.now(),
        mint: toToken.mint,
        side: "buy",
        solAmount: fromToken.symbol === "SOL" ? amtNum : 0,
        tokenAmount: outUi,
        priceUsd: fromToken.symbol === "USDC" || fromToken.symbol === "USDT" ? 1 : 0,
      });
      fetch(`${API_URL}/api/trades/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          mint: toToken.mint,
          side: "buy",
          tokenAmount: outUi || null,
          priceUsd: fromToken.symbol === "USDC" || fromToken.symbol === "USDT" ? 1 : null,
          tokenName: `${fromToken.symbol} → ${toToken.symbol}`,
          tokenSymbol: toToken.symbol,
          txSignature: typeof result.signature === "string" ? result.signature : `swap-${Date.now()}`,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      onActivityLogged?.();

      const sig = typeof result.signature === "string" ? result.signature : undefined;
      showResultModal({
        type: "success",
        title: "Swap complete",
        message: `Swapped ${amount} ${fromToken.symbol} → ${toToken.symbol}.`,
        txSignature: sig,
      });
      setAmount("");
      setQuoteData(null);
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
      queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });
    } catch (err) {
      showResultModal({
        type: "error",
        title: "Swap failed",
        message: err instanceof Error ? err.message : "Swap could not be completed.",
      });
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, amount, fromToken, toToken, quoteData, showResultModal, queryClient, onActivityLogged]);

  const outDisplay = quoteData
    ? (parseInt(quoteData.outAmount, 10) / 10 ** toToken.decimals).toFixed(toToken.decimals === 9 ? 6 : 2)
    : "—";

  return (
    <div className="space-y-3">
      {/* From */}
      <div className="rounded-lg border p-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sub text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>From</span>
          <select
            value={fromIdx}
            onChange={(e) => { setFromIdx(Number(e.target.value)); setQuoteData(null); }}
            className="bg-transparent font-heading text-xs font-semibold outline-none cursor-pointer"
            style={{ color: "var(--text-1)" }}
          >
            {SWAP_TOKENS.map((t, i) => i !== toIdx && <option key={t.mint} value={i}>{t.symbol}</option>)}
          </select>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); fetchQuote(e.target.value); }}
          placeholder="0.00"
          step="any"
          min="0"
          className="w-full bg-transparent font-money tabular-nums text-xl font-bold outline-none placeholder:text-[var(--text-3)]"
          style={{ color: "var(--text-1)" }}
        />
      </div>

      {/* Flip */}
      <div className="flex justify-center -my-1">
        <button type="button" onClick={flipTokens}
          className="rounded-full border p-1.5 hover:bg-[var(--bg-elevated)] transition-colors"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}>
          <ArrowRightLeft className="h-3.5 w-3.5 rotate-90" />
        </button>
      </div>

      {/* To */}
      <div className="rounded-lg border p-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sub text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>To</span>
          <select
            value={toIdx}
            onChange={(e) => { setToIdx(Number(e.target.value)); setQuoteData(null); }}
            className="bg-transparent font-heading text-xs font-semibold outline-none cursor-pointer"
            style={{ color: "var(--text-1)" }}
          >
            {SWAP_TOKENS.map((t, i) => i !== fromIdx && <option key={t.mint} value={i}>{t.symbol}</option>)}
          </select>
        </div>
        <p className="font-money tabular-nums text-xl font-bold" style={{ color: quoteData ? "var(--text-1)" : "var(--text-3)" }}>
          {quoting ? <Loader2 className="h-5 w-5 animate-spin inline" /> : outDisplay}
        </p>
      </div>

      

      <button
        type="button"
        onClick={executeSwap}
        disabled={loading || !quoteData || !publicKey || !amount}
        className="w-full rounded-lg py-3 font-heading text-sm font-bold disabled:opacity-40 transition-all"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
      </button>
    </div>
  );
}

// ── Token Row ───────────────────────────────────────────────────────

function TokenRow({ symbol, balance, usdValue }: {
  symbol: string; balance: number; usdValue: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <span className="font-heading text-sm font-medium" style={{ color: "var(--text-1)" }}>
        {symbol}
      </span>
      <div className="text-right">
        <p className="font-money tabular-nums text-sm font-semibold" style={{ color: "var(--text-1)" }}>
          {fmtToken(balance, symbol === "SOL" ? 4 : 2)}
        </p>
        <p className="font-money tabular-nums text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
          ${fmtUsd(usdValue)}
        </p>
      </div>
    </div>
  );
}

// ── Position Row ────────────────────────────────────────────────────

function PositionRow({ position: p, onEntrySaved }: { position: Position; onEntrySaved: () => void }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [avgCentsDraft, setAvgCentsDraft] = useState("");
  const { setSelectedToken } = useSirenStore();
  const { publicKey } = useSirenWallet();
  const walletKey = publicKey?.toBase58() ?? null;
  const showResultModal = useResultModalStore((s) => s.show);

  const { data: shareProfile } = useQuery({
    queryKey: ["user-profile", walletKey],
    queryFn: async () => {
      if (!walletKey) return null;
      const res = await fetch(`${API_URL}/api/users/profile?wallet=${encodeURIComponent(walletKey)}`, { credentials: "omit" });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => ({}));
      return (payload?.data ?? null) as { username?: string; display_name?: string } | null;
    },
    enabled: !!walletKey && shareOpen,
    staleTime: 60_000,
  });

  const settled = p.status === "settled";
  const shares = p.quantity ?? p.balance ?? 0;
  const prob = p.probability ?? 0;
  const probPct = prob > 1 ? prob : prob * 100;
  const current = p.currentPriceUsd ?? p.currentPrice ?? (prob > 1 ? prob / 100 : prob);
  const kalshiUrl = p.kalshi_url || `https://kalshi.com/markets/${p.ticker?.toLowerCase()}`;
  const markCents = markCentsForSide(p.side, p.probability);
  const savedEntry = p.mint ? getPositionEntry(p.mint) : null;
  const draftParsed = avgCentsDraft.trim() === "" ? Number.NaN : parseFloat(avgCentsDraft);
  const draftAvg =
    Number.isFinite(draftParsed) && draftParsed >= 0 && draftParsed <= 100 ? draftParsed : null;
  const avgCentsForPnl = draftAvg ?? savedEntry?.avgCents ?? null;
  const fromLocalAvg =
    avgCentsForPnl != null && shares > 0
      ? pnlFromAvgEntry({
          side: p.side,
          probability: p.probability,
          shares,
          avgCents: avgCentsForPnl,
        })
      : null;
  const apiPnl = computePositionPnl(p);
  const pnl = fromLocalAvg != null ? fromLocalAvg.pnlUsd : apiPnl.usd;
  const pnlPct = fromLocalAvg != null ? fromLocalAvg.pnlPct : apiPnl.pct;
  const pnlIsPreview =
    draftAvg != null && (!savedEntry || Math.abs(draftAvg - savedEntry.avgCents) > 1e-6);
  const stakeForCard =
    savedEntry && shares > 0 ? (shares * savedEntry.avgCents) / 100 : null;
  const valueForCard =
    typeof p.marketValueUsd === "number" && Number.isFinite(p.marketValueUsd)
      ? p.marketValueUsd
      : shares > 0
        ? (shares * markCents) / 100
        : null;

  const handleSell = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    if (!p.mint) return;
    const sideLower = p.side?.toLowerCase();
    const marketSide: "yes" | "no" | undefined =
      sideLower === "yes" || sideLower === "no" ? sideLower : undefined;
    setSelectedToken(
      {
        mint: p.mint,
        name: p.title || p.ticker,
        symbol: p.ticker,
        price: typeof current === "number" ? current : prob > 1 ? prob / 100 : prob,
        assetType: "prediction",
        marketTicker: p.ticker,
        marketTitle: p.title,
        marketSide,
        marketProbability: probPct,
      },
      { openForSell: true },
    );
  };

  const handleSharePnL = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    setShareOpen(true);
  };

  const shareHandle =
    shareProfile?.username?.trim() ||
    shareProfile?.display_name?.trim() ||
    (walletKey ? `${walletKey.slice(0, 4)}…${walletKey.slice(-4)}` : null);

  const valueUsdDisplay =
    typeof p.marketValueUsd === "number" && Number.isFinite(p.marketValueUsd)
      ? p.marketValueUsd
      : shares > 0
        ? (shares * markCents) / 100
        : null;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-colors hover:border-[var(--accent)]/35"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
    >
      <div className="px-5 py-6 space-y-5" style={{ borderLeft: "4px solid var(--accent)" }}>
        <div>
          <h3 className="font-heading text-lg font-semibold leading-snug" style={{ color: "var(--text-1)" }}>
            {p.title || p.ticker}
          </h3>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-sub text-sm" style={{ color: "var(--text-3)" }}>
            <span
              className="rounded-md px-2 py-0.5 font-heading text-[11px] font-semibold uppercase"
              style={{
                background: p.side === "yes" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                color: p.side === "yes" ? "var(--up)" : "var(--down)",
              }}
            >
              {p.side}
            </span>
            <span>{shares.toFixed(shares >= 1 ? 0 : 2)} shares</span>
            {settled && (
              <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                Settled
              </span>
            )}
          </p>
        </div>

        <div
          className="rounded-xl px-4 py-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="font-sub text-[11px] uppercase tracking-wider mb-1 flex flex-wrap items-center gap-2" style={{ color: "var(--text-3)" }}>
            <span>
              Unrealized PnL
              {pnlIsPreview && (
                <span className="normal-case ml-2 opacity-80">(updates as you type — tap Save to keep)</span>
              )}
            </span>
            {!settled && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[9px] font-bold normal-case tracking-normal" style={{ background: "rgba(34,197,94,0.12)", color: "var(--up)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--up)" }} aria-hidden />
                Live mark
              </span>
            )}
          </p>
          <p className="font-money tabular-nums text-3xl font-bold leading-none" style={{ color: pnlColor(pnl) }}>
            {pnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(pnl))}
          </p>
          {Number.isFinite(pnlPct) && pnlPct !== 0 && (
            <p className="font-money tabular-nums text-lg font-semibold mt-2" style={{ color: pnlColor(pnlPct) }}>
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toFixed(1)}%
            </p>
          )}
        </div>

        <p className="font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          About <span className="font-money tabular-nums">{markCents.toFixed(0)}¢</span> per share right now
          {valueUsdDisplay != null && (
            <>
              {" "}
              (~<span className="font-money tabular-nums">${fmtUsd(valueUsdDisplay)}</span> total)
            </>
          )}
          .
        </p>

        {p.yesBid != null && p.yesAsk != null && (
          <div>
            <button
              type="button"
              className="font-sub text-xs underline-offset-2 hover:underline"
              style={{ color: "var(--text-3)" }}
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide" : "Show"} order book (bid / ask)
            </button>
            {showDetails && (
              <p className="mt-2 font-money text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
                Bid {p.yesBid} · Ask {p.yesAsk}
              </p>
            )}
          </div>
        )}

        {!settled && (
          <p className="font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
            To estimate profit or loss, enter what you paid per share in cents (for example 20), then Save. We do not see
            your Kalshi history automatically.
          </p>
        )}

        {!settled && p.mint && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="font-sub text-[11px] uppercase tracking-wide block mb-1" style={{ color: "var(--text-3)" }}>
                Paid (¢ per share)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={1}
                placeholder={savedEntry ? String(savedEntry.avgCents) : "e.g. 20"}
                value={avgCentsDraft}
                onChange={(e) => setAvgCentsDraft(e.target.value)}
                className="w-28 rounded-lg border px-3 py-2.5 font-money text-base tabular-nums outline-none"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface)",
                  color: "var(--text-1)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                const n = parseFloat(avgCentsDraft);
                if (!p.mint || !Number.isFinite(n) || n < 0 || n > 100) {
                  showResultModal({
                    type: "error",
                    title: "Check the number",
                    message: "Use a price in cents between 0 and 100.",
                  });
                  return;
                }
                setPositionEntry(p.mint, n);
                setAvgCentsDraft("");
                onEntrySaved();
                showResultModal({
                  type: "success",
                  title: "Saved",
                  message: "We will use this on this device for PnL on this position.",
                });
              }}
              className="rounded-lg px-5 py-2.5 font-heading text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Save
            </button>
            {savedEntry && (
              <span
                className="rounded-full border px-3 py-1 font-heading text-xs font-semibold self-center"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Saved @ {savedEntry.avgCents.toFixed(0)}¢
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={kalshiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 font-heading text-xs font-semibold hover:brightness-110 transition-all"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
          >
            View on Kalshi ↗
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 font-heading text-xs font-semibold hover:brightness-110 transition-all"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Terminal
          </Link>
          <button
            type="button"
            onClick={handleSharePnL}
            className="inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 font-heading text-xs font-semibold transition-all hover:brightness-110"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          {!settled && p.mint && (
            <button
              type="button"
              onClick={handleSell}
              className="rounded-lg px-4 py-2.5 font-heading text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(239,68,68,0.15)", color: "var(--down)" }}
            >
              Sell
            </button>
          )}
        </div>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          onClick={() => setShareOpen(false)}
          role="presentation"
        >
          <div
            className="relative max-h-[90vh] overflow-y-auto rounded-2xl border p-5 max-w-md w-full"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-pnl-title"
          >
            <h3 id="share-pnl-title" className="font-heading text-base font-semibold mb-4" style={{ color: "var(--text-1)" }}>
              Share position
            </h3>
            <TradePnLCard
              token={{ name: p.title || p.ticker, symbol: p.ticker }}
              profitUsd={pnl}
              percent={pnlPct}
              kalshiMarket={`${p.side.toUpperCase()} · ${p.title || p.ticker}`}
              wallet={walletKey}
              displayName={shareHandle}
              stakeUsd={stakeForCard}
              valueUsd={valueForCard}
            />
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="mt-4 w-full rounded-lg border py-2.5 font-heading text-sm"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { publicKey, signMessage, connected } = useSirenWallet();
  const { connection } = useConnection();
  const { fundWallet } = useSolanaFundWallet();
  const addToast = useToastStore((s) => s.addToast);
  const showResultModal = useResultModalStore((s) => s.show);

  const queryClient = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [positionTab, setPositionTab] = useState<"open" | "settled">("open");
  const [proofLoading, setProofLoading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [entryEpoch, setEntryEpoch] = useState(0);
  const [activityEpoch, setActivityEpoch] = useState(0);

  const walletKey = publicKey?.toBase58() ?? null;

  const localActivity = useMemo(() => {
    if (!walletKey) return [];
    return [...readLocalTrades(walletKey)].sort((a, b) => b.ts - a.ts).slice(0, 40);
  }, [walletKey, activityEpoch]);

  useEffect(() => {
    const bump = () => setActivityEpoch((n) => n + 1);
    window.addEventListener("focus", bump);
    window.addEventListener("siren-activity-logged", bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("siren-activity-logged", bump);
    };
  }, []);

  // ── Username / Profile ──────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["user-profile", walletKey],
    queryFn: async () => {
      if (!walletKey) return null;
      const res = await fetch(`${API_URL}/api/users/profile?wallet=${encodeURIComponent(walletKey)}`, { credentials: "omit" });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => ({}));
      return (payload?.data ?? null) as {
        username?: string;
        display_name?: string;
        avatar_url?: string | null;
      } | null;
    },
    enabled: !!walletKey,
    staleTime: 60_000,
  });

  const saveUsername = useCallback(async () => {
    if (!walletKey || !usernameInput.trim()) return;
    setUsernameSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletKey, username: usernameInput.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showResultModal({
          type: "error",
          title: "Username",
          message: typeof payload?.error === "string" ? payload.error : "Could not save username.",
        });
        return;
      }
      showResultModal({ type: "success", title: "Username saved", message: "Your handle is updated on Siren." });
      setEditingUsername(false);
      queryClient.invalidateQueries({ queryKey: ["user-profile", walletKey] });
    } catch {
      showResultModal({ type: "error", title: "Username", message: "Network error. Try again." });
    } finally {
      setUsernameSaving(false);
    }
  }, [walletKey, usernameInput, showResultModal, queryClient]);

  // ── Balances ──────────────────────────────────────────────────

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["portfolio-balances", walletKey],
    queryFn: async () => {
      if (!publicKey) return { sol: 0, usdc: 0, usdt: 0 };
      const [lamports, usdcAccounts, usdtAccounts] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(SOLANA_USDC_MINT) }),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(SOLANA_USDT_MINT) }),
      ]);
      const extractUi = (accts: typeof usdcAccounts): number =>
        accts.value.reduce((sum, { account }) => {
          const parsed = account.data as {
            parsed?: { info?: { tokenAmount?: { uiAmount: number | null } } };
          };
          return sum + (parsed.parsed?.info?.tokenAmount?.uiAmount ?? 0);
        }, 0);
      return { sol: lamports / LAMPORTS_PER_SOL, usdc: extractUi(usdcAccounts), usdt: extractUi(usdtAccounts) };
    },
    enabled: !!publicKey,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const sol = balances?.sol ?? 0;
  const usdc = balances?.usdc ?? 0;
  const usdt = balances?.usdt ?? 0;

  const { data: solPrice = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetchSolPriceUsd(API_URL),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const solUsd = sol * solPrice;
  const totalUsd = solUsd + usdc + usdt;

  // ── Positions ─────────────────────────────────────────────────

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ["dflow-positions", walletKey],
    queryFn: async (): Promise<Position[]> => {
      if (!publicKey) return [];
      const res = await fetch(
        `${API_URL}/api/dflow/positions?address=${encodeURIComponent(publicKey.toBase58())}`,
        { credentials: "omit" },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to refresh positions right now.");
      }
      const payload = await res.json().catch(() => ({}));
      return (payload?.data?.positions ?? []) as Position[];
    },
    enabled: !!publicKey,
    staleTime: 12_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!publicKey || !walletKey) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const url = `${API_URL}/api/dflow/positions/stream?address=${encodeURIComponent(walletKey)}`;
    let source: EventSource;
    try {
      source = new EventSource(url);
    } catch {
      return;
    }
    const onMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as {
          success?: boolean;
          data?: { positions?: Position[] };
        };
        const list = parsed?.data?.positions;
        if (Array.isArray(list)) {
          queryClient.setQueryData(["dflow-positions", walletKey], list);
        }
      } catch {
        /* ignore malformed SSE payloads */
      }
    };
    source.addEventListener("message", onMessage);
    return () => {
      source.removeEventListener("message", onMessage);
      source.close();
    };
  }, [publicKey, walletKey, queryClient]);

  const openPositions = positions.filter((p) => p.status !== "settled");
  const settledPositions = positions.filter((p) => p.status === "settled");
  const activeTab = positionTab === "open" ? openPositions : settledPositions;
  const openBookUsd = useMemo(
    () => openPositions.reduce((sum, position) => sum + positionMarketValueUsd(position), 0),
    [openPositions],
  );
  const totalPnl = useMemo(
    () => positions.reduce((sum, p) => sum + computePositionPnl(p).usd, 0),
    [positions, entryEpoch],
  );
  const largestOpenPosition = useMemo(
    () =>
      openPositions.reduce<Position | null>((largest, position) => {
        if (!largest) return position;
        return positionMarketValueUsd(position) > positionMarketValueUsd(largest) ? position : largest;
      }, null),
    [openPositions],
  );
  const correlatedRiskClusters = useMemo(() => {
    const clusterMap = new Map<string, RiskCluster>();
    for (const position of openPositions) {
      for (const tag of inferRiskTags(position)) {
        const existing = clusterMap.get(tag) || { label: tag, positions: [], exposureUsd: 0, pnlUsd: 0 };
        existing.positions.push(position);
        existing.exposureUsd += positionMarketValueUsd(position);
        existing.pnlUsd += computePositionPnl(position).usd;
        clusterMap.set(tag, existing);
      }
    }
    return Array.from(clusterMap.values())
      .filter((cluster) => cluster.positions.length > 1)
      .sort((a, b) => b.exposureUsd - a.exposureUsd)
      .slice(0, 4);
  }, [openPositions, entryEpoch]);

  const { data: tradeAttemptData } = useQuery({
    queryKey: ["trade-attempts-feed", walletKey],
    queryFn: async () => {
      if (!walletKey) return { rows: [], summary: { attempts: 0, successCount: 0, failedCount: 0, partialCount: 0, successRate: 0 } } as TradeAttemptFeedData;
      const res = await fetch(`${API_URL}/api/trade-attempts?wallet=${encodeURIComponent(walletKey)}&limit=12`, { credentials: "omit" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Unable to load trade attempts.");
      return (payload?.data ?? { rows: [], summary: { attempts: 0, successCount: 0, failedCount: 0, partialCount: 0, successRate: 0 } }) as TradeAttemptFeedData;
    },
    enabled: !!walletKey,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: goldRushIntelligence, isLoading: goldRushLoading, isError: goldRushError } = useGoldRushWalletIntelligence(walletKey);
  const { data: torqueReadiness } = useTorqueRelayReadiness();

  // ── Identity ──────────────────────────────────────────────────

  const { data: proofStatus } = useQuery({
    queryKey: ["dflow-proof-status", walletKey],
    queryFn: async () => {
      if (!publicKey) return { verified: false };
      const res = await fetch(
        `${API_URL}/api/dflow/proof-status?address=${encodeURIComponent(publicKey.toBase58())}`,
        { credentials: "omit" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Unable to check identity.");
      return (payload?.data ?? { verified: false }) as { verified: boolean };
    },
    enabled: !!publicKey,
    staleTime: 120_000,
  });

  const verified = !!proofStatus?.verified;

  // ── Actions ───────────────────────────────────────────────────

  const handleDeposit = useCallback(async () => {
    hapticLight();
    if (!publicKey) {
      showResultModal({ type: "error", title: "Wallet", message: "Connect your wallet first." });
      return;
    }
    try {
      await fundWallet({ address: publicKey.toBase58(), options: buildSolanaFundingConfig() });
    } catch (err) {
      if (err instanceof Error && !err.message.includes("cancelled")) {
        showResultModal({ type: "error", title: "Deposit", message: err.message });
      }
    }
  }, [publicKey, fundWallet, showResultModal]);

  const openVerify = useCallback(async () => {
    hapticLight();
    if (!publicKey || !signMessage) {
      showResultModal({ type: "error", title: "Verify", message: "Connect your wallet to verify identity." });
      return;
    }
    setProofLoading(true);
    try {
      const timestamp = Date.now();
      const message = buildProofMessage(timestamp);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = encodeProofSignature(sigBytes);
      const redirectUri = buildProofRedirectUri(
        `${window.location.origin}/portfolio`, publicKey.toBase58(),
      );
      const link = buildProofDeepLink({ wallet: publicKey.toBase58(), signature, timestamp, redirectUri });
      window.open(link, "_blank", "noopener,noreferrer");
      showResultModal({
        type: "info",
        title: "Complete verification",
        message: "We opened DFlow in a new tab. Finish there, then return to trade.",
      });
    } catch (err) {
      showResultModal({
        type: "error",
        title: "Verification",
        message: err instanceof Error ? err.message : "Verification could not start.",
      });
    } finally { setProofLoading(false); }
  }, [publicKey, signMessage, showResultModal]);

  const copyAddress = useCallback(() => {
    if (!walletKey) return;
    navigator.clipboard.writeText(walletKey);
    setAddressCopied(true);
    addToast("Address copied", "success");
    setTimeout(() => setAddressCopied(false), 2000);
  }, [walletKey, addToast]);

  // ── Render ────────────────────────────────────────────────────

  const loading = !connected || balancesLoading;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-12 pt-5 font-body md:px-6 md:pt-7 xl:px-8">

        {/* ── Top row: Balance + Username ─────────────────── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">

          {/* Balance Card */}
          <div className="rounded-xl border p-5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <p className="font-sub text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                Total Balance
              </p>
              <button type="button" onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
                queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });
                queryClient.invalidateQueries({ queryKey: ["sol-price"] });
              }}
                className="rounded p-1 hover:bg-[var(--bg-elevated)] transition-colors"
                style={{ color: "var(--text-3)" }}>
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            {loading ? (
              <div className="mt-3 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
              </div>
            ) : (
              <p className="mt-1.5 font-money tabular-nums text-3xl font-bold tracking-tight" style={{ color: "var(--text-1)" }}>
                ${fmtUsd(totalUsd)}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { hapticLight(); setDepositOpen(true); }} disabled={!connected}
                className="flex flex-col items-center gap-1 rounded-lg py-2.5 font-heading text-[11px] font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                <CreditCard className="h-3.5 w-3.5" /> Deposit
              </button>
              <button type="button" disabled={!connected}
                onClick={() => { hapticLight(); setWithdrawOpen(true); }}
                className="flex flex-col items-center gap-1 rounded-lg border py-2.5 font-heading text-[11px] font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}>
                <ArrowUp className="h-3.5 w-3.5" /> Withdraw
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Open book", value: `$${fmtUsd(openBookUsd)}` },
                { label: "Dry powder", value: `$${fmtUsd(usdc + usdt)}` },
                { label: "Status", value: verified ? "Ready" : "Needs ID" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border px-3 py-3"
                  style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
                >
                  <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                    {item.label}
                  </p>
                  <p className="mt-1 font-heading text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: balances + username + identity */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <TokenRow symbol="SOL" balance={sol} usdValue={solUsd} />
              <TokenRow symbol="USDC" balance={usdc} usdValue={usdc} />
              <TokenRow symbol="USDT" balance={usdt} usdValue={usdt} />
            </div>

            {/* Username */}
            {connected && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                {editingUsername ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_.\-]/g, "").slice(0, 20))}
                      placeholder="Pick a username"
                      autoFocus
                      maxLength={20}
                      className="flex-1 rounded-md border bg-transparent px-2.5 py-1 font-body text-xs outline-none"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                      onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
                    />
                    <button type="button" onClick={saveUsername} disabled={usernameSaving || usernameInput.trim().length < 2}
                      className="rounded-md px-2.5 py-1 font-heading text-[11px] font-semibold disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                      {usernameSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover shrink-0 border"
                          style={{ borderColor: "var(--border-subtle)" }}
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--accent), #00C853)" }}>
                          <span className="font-heading text-[10px] font-bold" style={{ color: "var(--bg-base)" }}>
                            {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="font-body text-xs font-medium truncate" style={{ color: "var(--text-1)" }}>
                        {profile?.display_name || profile?.username || "Set username"}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Link
                        href="/settings"
                        onClick={() => hapticLight()}
                        className="rounded-md p-1 hover:bg-[var(--bg-elevated)]"
                        style={{ color: "var(--text-3)" }}
                        aria-label="Settings"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Link>
                      <button type="button"
                        onClick={() => { hapticLight(); setUsernameInput(profile?.username || ""); setEditingUsername(true); }}
                        className="rounded-md p-1 hover:bg-[var(--bg-elevated)]"
                        style={{ color: "var(--text-3)" }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Identity */}
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" style={{ color: verified ? "var(--up)" : "var(--text-3)" }} />
                <span className="font-body text-xs"
                  style={{ color: verified ? "var(--up)" : "var(--text-2)" }}>
                  {verified ? "Ready to trade Kalshi" : "Verify identity to trade Kalshi"}
                </span>
              </div>
              {!verified && connected && (
                <button type="button" onClick={openVerify} disabled={proofLoading}
                  className="flex items-center gap-1 font-body text-[11px] font-medium disabled:opacity-50"
                  style={{ color: "var(--accent)" }}>
                  {proofLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify identity"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-4 rounded-[22px] border p-4 md:p-5"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(250px,0.75fr)] lg:items-start">
            <div>
              <p className="font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                Portfolio command
              </p>
              <h2 className="mt-1 font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                Live exposure, realized outcomes, and execution readiness in one glance.
              </h2>
            </div>
            <div
              className="rounded-xl border px-3 py-2"
              style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
            >
              <p className="font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                Largest live line
              </p>
              <p className="mt-1 max-w-[220px] truncate font-body text-sm font-medium" style={{ color: "var(--text-1)" }}>
                {largestOpenPosition?.title ?? "No open positions"}
              </p>
              <p className="mt-1 font-money text-xs tabular-nums" style={{ color: "var(--text-2)" }}>
                {largestOpenPosition ? `$${fmtUsd(positionMarketValueUsd(largestOpenPosition))}` : "Waiting for your first fill"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              { label: "Open book", value: String(openPositions.length), detail: "positions live", tone: "var(--text-1)" },
              { label: "Settled", value: String(settledPositions.length), detail: "resolved lines", tone: "var(--text-1)" },
              { label: "Net P&L", value: `${totalPnl >= 0 ? "+" : "-"}$${fmtUsd(Math.abs(totalPnl))}`, detail: "across tracked positions", tone: pnlColor(totalPnl) },
              { label: "Execution", value: verified ? "Kalshi ready" : "ID check", detail: verified ? "verification complete" : "complete venue verification", tone: verified ? "var(--up)" : "var(--accent)" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border px-3 py-3"
                style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
              >
                <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                  {item.label}
                </p>
                <p className="mt-1 font-heading text-sm font-semibold" style={{ color: item.tone }}>
                  {item.value}
                </p>
                <p className="mt-1 font-body text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.92fr)]">
          <div className="space-y-4">
            <div className="rounded-[22px] border p-4 md:p-5"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  Positions
                </h2>
                {positions.length > 0 && (
                  <span className="font-money tabular-nums text-xs font-semibold" style={{ color: pnlColor(totalPnl) }}>
                    {totalPnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(totalPnl))}
                  </span>
                )}
              </div>
              <p className="mt-2 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                Open positions refresh while this page is open so prices stay current.
              </p>

              <div className="mt-3 flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-base)" }}>
                {(["open", "settled"] as const).map((tab) => (
                  <button key={tab} type="button"
                    onClick={() => { hapticLight(); setPositionTab(tab); }}
                    className="flex-1 rounded-md py-1.5 font-heading text-xs font-semibold capitalize transition-colors"
                    style={{
                      background: positionTab === tab ? "var(--bg-surface)" : "transparent",
                      color: positionTab === tab ? "var(--text-1)" : "var(--text-3)",
                    }}>
                    {tab}{" "}
                    <span className="font-sub text-[10px] tabular-nums">
                      ({tab === "open" ? openPositions.length : settledPositions.length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {positionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
                  </div>
                ) : activeTab.length === 0 ? (
                  <p className="py-8 text-center font-body text-sm" style={{ color: "var(--text-3)" }}>
                    {positionTab === "open" ? "No open positions yet." : "No settled positions yet."}
                  </p>
                ) : (
                  activeTab.map((p, i) => (
                    <PositionRow
                      key={`${p.ticker}-${i}`}
                      position={p}
                      onEntrySaved={() => setEntryEpoch((n) => n + 1)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[22px] border overflow-hidden"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
              <button type="button" className="flex w-full items-center justify-between px-4 py-3.5"
                onClick={() => { hapticLight(); setSwapOpen(!swapOpen); }}>
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <span className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Swap
                  </span>
                </div>
                <ChevronDown style={{ color: "var(--text-3)" }}
                  className={`h-4 w-4 transition-transform duration-200 ${swapOpen ? "rotate-180" : ""}`} />
              </button>
              {swapOpen && (
                <div className="border-t px-4 py-4" style={{ borderColor: "var(--border-subtle)" }}>
                  <SwapPanel onActivityLogged={() => setActivityEpoch((n) => n + 1)} />
                </div>
              )}
            </div>

            {connected && walletKey && (
              <div
                className="rounded-[22px] border p-5"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
              >
                <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  Recent activity
                </h2>
                <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Your recent swaps and market trades. Saved on this device only.
                </p>
                {localActivity.length === 0 ? (
                  <p className="mt-6 py-8 text-center font-body text-sm" style={{ color: "var(--text-3)" }}>
                    Nothing here yet. Make a trade to get started.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {localActivity.map((row, idx) => (
                      <li
                        key={`${row.ts}-${row.mint}-${idx}`}
                        className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                      >
                        <p className="min-w-0 font-body text-sm leading-snug" style={{ color: "var(--text-1)" }}>
                          {formatActivitySummary(row)}
                        </p>
                        <time
                          className="shrink-0 pt-0.5 font-sub text-[11px] tabular-nums"
                          style={{ color: "var(--text-3)" }}
                          dateTime={new Date(row.ts).toISOString()}
                        >
                          {formatActivityTime(row.ts)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-[94px] xl:self-start">
            {connected && (
              <>
                <div className="rounded-[22px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Correlated risk groups
                  </h2>
                  <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                    Positions leaning on the same narrative, grouped for concentration awareness.
                  </p>
                  {correlatedRiskClusters.length === 0 ? (
                    <p className="mt-5 py-2 font-body text-sm" style={{ color: "var(--text-3)" }}>
                      No strong overlap detected yet. As your open book grows, Siren will cluster related exposure here.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {correlatedRiskClusters.map((cluster) => (
                        <div
                          key={cluster.label}
                          className="rounded-xl border px-4 py-3"
                          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-heading text-sm" style={{ color: "var(--text-1)" }}>{cluster.label}</p>
                              <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                                {cluster.positions.length} positions · ${fmtUsd(cluster.exposureUsd)} exposed
                              </p>
                            </div>
                            <p className="font-mono text-[11px] tabular-nums" style={{ color: pnlColor(cluster.pnlUsd) }}>
                              {cluster.pnlUsd >= 0 ? "+" : "-"}${fmtUsd(Math.abs(cluster.pnlUsd))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[22px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Post-trade reports
                  </h2>
                  <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                    Recent route outcomes from Siren’s attempt log.
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Attempts", value: String(tradeAttemptData?.summary.attempts ?? 0), tone: "var(--text-1)" },
                      { label: "Success", value: `${Math.round(tradeAttemptData?.summary.successRate ?? 0)}%`, tone: "var(--accent)" },
                      { label: "Partial", value: String(tradeAttemptData?.summary.partialCount ?? 0), tone: "var(--up)" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border px-3 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                        <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>{item.label}</p>
                        <p className="mt-1 font-heading text-sm font-semibold" style={{ color: item.tone }}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {(tradeAttemptData?.rows?.length ?? 0) === 0 ? (
                    <p className="mt-5 py-2 font-body text-sm" style={{ color: "var(--text-3)" }}>
                      No persisted execution reports yet. Once trades are logged through Supabase, recent outcomes will show here.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {tradeAttemptData?.rows.slice(0, 4).map((row, idx) => {
                        const narrative = buildTradeAttemptNarrative(row);
                        return (
                          <li
                            key={`${row.createdAt}-${row.txSignature ?? row.market ?? idx}`}
                            className="rounded-xl border px-4 py-3"
                            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className="rounded-full px-2 py-0.5 font-sub text-[10px] uppercase tracking-[0.16em]"
                                    style={{
                                      background: row.status === "success" ? "color-mix(in srgb, var(--up) 16%, transparent)" : "color-mix(in srgb, var(--down) 14%, transparent)",
                                      color: row.status === "success" ? "var(--up)" : "var(--down)",
                                    }}
                                  >
                                    {row.status}
                                  </span>
                                  <span className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                                    {row.venue} · {row.mode}
                                  </span>
                                </div>
                                <p className="mt-2 font-body text-sm" style={{ color: "var(--text-1)" }}>
                                  {narrative.title}
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Attempted</p>
                                    <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--text-1)" }}>
                                      {formatAttemptAmount(row)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Siren advice</p>
                                    <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                                      {narrative.advice}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Outcome</p>
                                    <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: row.status === "success" ? "var(--up)" : "var(--text-2)" }}>
                                      {narrative.result}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <time className="font-sub text-[11px] text-right" style={{ color: "var(--text-3)" }} dateTime={row.createdAt}>
                                {new Date(row.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </time>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-[22px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        GoldRush wallet intelligence
                      </h2>
                      <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                        Structured wallet context for reserves, concentration, and execution readiness.
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 font-sub text-[10px] uppercase tracking-[0.16em]"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)", background: "var(--bg-base)" }}
                    >
                      Covalent
                    </span>
                  </div>

                  {goldRushLoading ? (
                    <div className="mt-5 flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
                      <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                        Reading wallet balances through GoldRush...
                      </p>
                    </div>
                  ) : goldRushError || !goldRushIntelligence ? (
                    <p className="mt-5 py-2 font-body text-sm" style={{ color: "var(--text-3)" }}>
                      GoldRush wallet intelligence is unavailable right now. Siren could not complete the live wallet read in this environment.
                    </p>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {[
                          { label: "Idle stables", value: `$${fmtUsd(goldRushIntelligence.summary.stablecoinUsd)}`, tone: "var(--accent)" },
                          { label: "Visible", value: `$${fmtUsd(goldRushIntelligence.summary.totalQuotedUsd)}`, tone: "var(--text-1)" },
                          { label: "Recent flow", value: `${goldRushIntelligence.summary.recentTxnCount}`, tone: "var(--text-1)" },
                          { label: "Risk", value: `${goldRushIntelligence.summary.riskScore}/100`, tone: goldRushIntelligence.summary.riskLabel === "high" ? "var(--down)" : goldRushIntelligence.summary.riskLabel === "moderate" ? "var(--yellow)" : "var(--up)" },
                        ].map((item) => (
                          <div key={item.label} className="rounded-xl border px-3 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                            <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                              {item.label}
                            </p>
                            <p className="mt-1 font-heading text-sm font-semibold" style={{ color: item.tone }}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                          <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                            Siren read
                          </p>
                          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                            {goldRushIntelligence.narrative.reserveRead}
                          </p>
                          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                            {goldRushIntelligence.narrative.readiness}
                          </p>
                        </div>

                        <div className="rounded-xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                          <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                            Activity monitor
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                              { label: "Inbound", value: `$${fmtUsd(goldRushIntelligence.summary.inboundUsd)}` },
                              { label: "Outbound", value: `$${fmtUsd(goldRushIntelligence.summary.outboundUsd)}` },
                              { label: "Open book", value: `$${fmtUsd(openBookUsd)}` },
                              { label: "Last active", value: goldRushIntelligence.summary.lastActiveAt ? new Date(goldRushIntelligence.summary.lastActiveAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Quiet" },
                            ].map((item) => (
                              <div key={item.label} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                                <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>{item.label}</p>
                                <p className="mt-1 font-heading text-xs font-semibold" style={{ color: "var(--text-1)" }}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {goldRushIntelligence.alerts.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {goldRushIntelligence.alerts.slice(0, 4).map((alert) => (
                            <div
                              key={alert.label}
                              className="rounded-xl border px-4 py-3"
                              style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-body text-sm" style={{ color: "var(--text-1)" }}>
                                  {alert.label}
                                </p>
                                <span className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: alert.level === "high" ? "var(--down)" : alert.level === "warn" ? "var(--yellow)" : "var(--accent)" }}>
                                  {alert.level}
                                </span>
                              </div>
                              <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                                {alert.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-[22px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Torque growth relay
                      </h2>
                      <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                        Execution outcomes can emit campaign-grade events for rebates and retention loops.
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 font-sub text-[10px] uppercase tracking-[0.16em]"
                      style={{ borderColor: "var(--border-subtle)", color: torqueReadiness?.configured ? "var(--up)" : "var(--text-3)", background: "var(--bg-base)" }}
                    >
                      {torqueReadiness?.configured ? "Relay live" : "Relay pending"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { label: "Attempts", value: String(tradeAttemptData?.summary.attempts ?? 0), tone: "var(--text-1)" },
                      { label: "Success", value: `${Math.round(tradeAttemptData?.summary.successRate ?? 0)}%`, tone: "var(--accent)" },
                      { label: "Partial", value: String(tradeAttemptData?.summary.partialCount ?? 0), tone: "var(--up)" },
                      { label: "Events", value: String(torqueReadiness?.eventNames.length ?? 0), tone: "var(--text-1)" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border px-3 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                        <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                          {item.label}
                        </p>
                        <p className="mt-1 font-heading text-sm font-semibold" style={{ color: item.tone }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                    <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Relay status
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {torqueReadiness?.summary ?? "Torque relay metadata is unavailable right now."}
                    </p>
                  </div>

                  {!!torqueReadiness?.requiredSchemas?.length && (
                    <div className="mt-4 rounded-xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Required custom events
                      </p>
                      <div className="mt-3 space-y-2">
                        {torqueReadiness.requiredSchemas.map((schema) => (
                          <div key={schema.eventName} className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                            <p className="font-mono text-xs" style={{ color: "var(--text-1)" }}>{schema.eventName}</p>
                            <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                              {schema.fields.join(" · ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>

        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 font-body text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
      </main>

      {depositOpen && walletKey && (
        <DepositModal
          walletKey={walletKey}
          onClose={() => setDepositOpen(false)}
          onFund={handleDeposit}
          addressCopied={addressCopied}
          onCopyAddress={copyAddress}
          loading={false}
        />
      )}
      {withdrawOpen && (
        <WithdrawModal solBalance={sol} solPrice={solPrice} onClose={() => setWithdrawOpen(false)} />
      )}
    </div>
  );
}
