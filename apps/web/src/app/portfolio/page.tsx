"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import Link from "next/link";
import {
  Shield, Loader2, ArrowLeft, Copy, Check,
  ChevronDown, ArrowUp, ArrowDown, CreditCard, Pencil, ArrowRightLeft, RefreshCw,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useToastStore } from "@/store/useToastStore";
import { hapticLight } from "@/lib/haptics";
import { fetchSolPriceUsd } from "@/lib/pricing";
import { useFundWallet as useSolanaFundWallet } from "@privy-io/react-auth/solana";
import { buildSolanaFundingConfig } from "@/lib/privyFunding";
import {
  buildProofDeepLink, buildProofMessage,
  buildProofRedirectUri, encodeProofSignature,
} from "@/lib/dflowProof";
import { API_URL } from "@/lib/apiUrl";

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
  const addToast = useToastStore((s) => s.addToast);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const amt = parseFloat(amount) || 0;
  const usdEst = amt > 0 ? amt * solPrice : 0;

  const handleSend = async () => {
    if (!publicKey || !signTransaction) return;
    if (!recipient.trim() || amt <= 0) { addToast("Enter a valid address and amount.", "error"); return; }
    if (amt > solBalance) { addToast(`Insufficient SOL. Available: ${solBalance.toFixed(4)}`, "error"); return; }

    let toPubkey: PublicKey;
    try { toPubkey = new PublicKey(recipient.trim()); }
    catch { addToast("Invalid Solana address.", "error"); return; }

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
      addToast(`Sent ${amt} SOL — ${sig.slice(0, 8)}…`, "success");
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Withdraw failed.", "error");
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
        <label className="mt-4 block font-body text-xs" style={{ color: "var(--text-3)" }}>
          Recipient address
        </label>
        <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
          placeholder="Solana address…"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
          style={inputStyle} />
        <label className="mt-3 block font-body text-xs" style={{ color: "var(--text-3)" }}>
          Amount (SOL)
        </label>
        <input type="number" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min={0} step="any"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
          style={inputStyle} />
        <div className="mt-1 flex items-center justify-between font-body text-[11px]"
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

// ── Swap Panel ──────────────────────────────────────────────────────

const SWAP_TOKENS = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
];

function SwapPanel() {
  const { publicKey, signTransaction } = useSirenWallet();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

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
      if (!orderRes.ok) throw new Error("Order failed");
      const order = await orderRes.json();
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

      addToast(`Swapped ${amount} ${fromToken.symbol} → ${toToken.symbol}`, "success");
      setAmount("");
      setQuoteData(null);
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
      queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Swap failed", "error");
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, amount, fromToken, toToken, addToast, queryClient]);

  const outDisplay = quoteData
    ? (parseInt(quoteData.outAmount, 10) / 10 ** toToken.decimals).toFixed(toToken.decimals === 9 ? 6 : 2)
    : "—";

  return (
    <div className="space-y-3">
      {/* From */}
      <div className="rounded-lg border p-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-body text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>From</span>
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
          className="w-full bg-transparent font-mono text-xl font-bold outline-none placeholder:text-[var(--text-3)]"
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
          <span className="font-body text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>To</span>
          <select
            value={toIdx}
            onChange={(e) => { setToIdx(Number(e.target.value)); setQuoteData(null); }}
            className="bg-transparent font-heading text-xs font-semibold outline-none cursor-pointer"
            style={{ color: "var(--text-1)" }}
          >
            {SWAP_TOKENS.map((t, i) => i !== fromIdx && <option key={t.mint} value={i}>{t.symbol}</option>)}
          </select>
        </div>
        <p className="font-mono text-xl font-bold" style={{ color: quoteData ? "var(--text-1)" : "var(--text-3)" }}>
          {quoting ? <Loader2 className="h-5 w-5 animate-spin inline" /> : outDisplay}
        </p>
      </div>

      {quoteData && parseFloat(quoteData.priceImpactPct) > 1 && (
        <p className="text-center font-body text-[10px]" style={{ color: "var(--down)" }}>
          Price impact: {parseFloat(quoteData.priceImpactPct).toFixed(2)}%
        </p>
      )}

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
        <p className="font-mono text-sm" style={{ color: "var(--text-1)" }}>
          {fmtToken(balance, symbol === "SOL" ? 4 : 2)}
        </p>
        <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
          ${fmtUsd(usdValue)}
        </p>
      </div>
    </div>
  );
}

// ── Position Row ────────────────────────────────────────────────────

function PositionRow({ position: p }: { position: Position }) {
  const settled = p.status === "settled";
  const pnl = p.pnlUsd ?? 0;
  const pnlPct = p.pnlPct ?? 0;
  const shares = p.quantity ?? p.balance ?? 0;
  const prob = p.probability ?? 0;
  const entry = p.entryPrice ?? 0;
  const current = p.currentPrice ?? (prob / 100);
  return (
    <div className="rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-medium" style={{ color: "var(--text-1)" }}>
            {p.title || p.ticker}
          </p>
          <div className="mt-1 flex items-center gap-2 font-body text-xs" style={{ color: "var(--text-3)" }}>
            <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
              style={{
                background: p.side === "yes" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                color: p.side === "yes" ? "var(--up)" : "var(--down)",
              }}>
              {p.side}
            </span>
            <span>{shares.toFixed(shares >= 1 ? 0 : 2)} shares</span>
            {settled && (
              <span className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)" }}>
                Settled
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold" style={{ color: pnlColor(pnl) }}>
            {pnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(pnl))}
          </p>
          {pnlPct !== 0 && (
            <p className="font-mono text-[11px]" style={{ color: pnlColor(pnlPct) }}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-4 border-t pt-2 font-mono text-[11px]"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>
        {entry > 0 && <span>Entry ${fmtUsd(entry)}</span>}
        {current > 0 && <span>{settled ? "Final" : "Current"} ${fmtUsd(current)}</span>}
        <span>Prob {prob > 1 ? prob.toFixed(0) : (prob * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { publicKey, signMessage, connected } = useSirenWallet();
  const { connection } = useConnection();
  const { fundWallet } = useSolanaFundWallet();
  const addToast = useToastStore((s) => s.addToast);

  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [positionTab, setPositionTab] = useState<"open" | "settled">("open");
  const [proofLoading, setProofLoading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;

  // ── Username / Profile ──────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["user-profile", walletKey],
    queryFn: async () => {
      if (!walletKey) return null;
      const res = await fetch(`${API_URL}/api/users/profile?wallet=${encodeURIComponent(walletKey)}`, { credentials: "omit" });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => ({}));
      return (payload?.data ?? null) as { username?: string; display_name?: string } | null;
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
        addToast(payload?.error || "Failed to save username", "error");
        return;
      }
      addToast("Username saved", "success");
      setEditingUsername(false);
      queryClient.invalidateQueries({ queryKey: ["user-profile", walletKey] });
    } catch {
      addToast("Network error saving username", "error");
    } finally {
      setUsernameSaving(false);
    }
  }, [walletKey, usernameInput, addToast, queryClient]);

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
      if (!res.ok) return [];
      const payload = await res.json().catch(() => ({}));
      return (payload?.data?.positions ?? []) as Position[];
    },
    enabled: !!publicKey,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const openPositions = positions.filter((p) => p.status !== "settled");
  const settledPositions = positions.filter((p) => p.status === "settled");
  const activeTab = positionTab === "open" ? openPositions : settledPositions;
  const totalPnl = positions.reduce((sum, p) => sum + (p.pnlUsd ?? 0), 0);

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
    if (!publicKey) { addToast("Connect wallet first.", "error"); return; }
    try {
      await fundWallet({ address: publicKey.toBase58(), options: buildSolanaFundingConfig() });
    } catch (err) {
      if (err instanceof Error && !err.message.includes("cancelled")) addToast(err.message, "error");
    }
  }, [publicKey, fundWallet, addToast]);

  const openVerify = useCallback(async () => {
    hapticLight();
    if (!publicKey || !signMessage) { addToast("Connect wallet to verify identity.", "error"); return; }
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
      addToast("Verification opened in a new tab.", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Verification failed.", "error");
    } finally { setProofLoading(false); }
  }, [publicKey, signMessage, addToast]);

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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-6 md:pt-8">

        {/* ── Top row: Balance + Username ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Balance Card */}
          <div className="rounded-xl border p-5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <p className="font-body text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
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
              <p className="mt-1.5 font-mono text-3xl font-bold" style={{ color: "var(--text-1)" }}>
                ${fmtUsd(totalUsd)}
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" onClick={handleDeposit} disabled={!connected}
                className="flex flex-col items-center gap-1 rounded-lg py-2.5 font-heading text-[11px] font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                <CreditCard className="h-3.5 w-3.5" /> Deposit
              </button>
              <button type="button" disabled={!connected}
                onClick={() => { hapticLight(); setReceiveOpen(!receiveOpen); }}
                className="flex flex-col items-center gap-1 rounded-lg border py-2.5 font-heading text-[11px] font-semibold disabled:opacity-40"
                style={{
                  borderColor: receiveOpen ? "var(--accent)" : "var(--border-subtle)",
                  color: receiveOpen ? "var(--accent)" : "var(--text-1)",
                }}>
                <ArrowDown className="h-3.5 w-3.5" /> Receive
              </button>
              <button type="button" disabled={!connected}
                onClick={() => { hapticLight(); setWithdrawOpen(true); }}
                className="flex flex-col items-center gap-1 rounded-lg border py-2.5 font-heading text-[11px] font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}>
                <ArrowUp className="h-3.5 w-3.5" /> Send
              </button>
            </div>

            {receiveOpen && walletKey && (
              <div className="mt-3 rounded-lg border p-3"
                style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                <p className="mb-1 font-body text-[10px]" style={{ color: "var(--text-3)" }}>
                  Send SOL or USDC to this address
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all font-mono text-[10px]"
                    style={{ color: "var(--text-1)" }}>
                    {walletKey}
                  </code>
                  <button type="button" onClick={copyAddress}
                    className="shrink-0 rounded-md p-1 hover:bg-[var(--bg-elevated)]"
                    style={{ color: "var(--text-2)" }}>
                    {addressCopied
                      ? <Check className="h-3 w-3" style={{ color: "var(--up)" }} />
                      : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column: tokens + username + identity */}
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
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ background: "linear-gradient(135deg, var(--accent), #00C853)" }}>
                        <span className="font-heading text-[10px] font-bold" style={{ color: "var(--bg-base)" }}>
                          {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-heading text-xs font-medium" style={{ color: "var(--text-1)" }}>
                        {profile?.display_name || profile?.username || "Set username"}
                      </span>
                    </div>
                    <button type="button"
                      onClick={() => { hapticLight(); setUsernameInput(profile?.username || ""); setEditingUsername(true); }}
                      className="rounded-md p-1 hover:bg-[var(--bg-elevated)]"
                      style={{ color: "var(--text-3)" }}>
                      <Pencil className="h-3 w-3" />
                    </button>
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
                  {verified ? "Kalshi KYC Verified" : "Kalshi KYC Not Verified"}
                </span>
              </div>
              {!verified && connected && (
                <button type="button" onClick={openVerify} disabled={proofLoading}
                  className="flex items-center gap-1 font-body text-[11px] font-medium disabled:opacity-50"
                  style={{ color: "var(--accent)" }}>
                  {proofLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Swap ──────────────────────────────────────────── */}
        <div className="mt-4 rounded-xl border overflow-hidden"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <button type="button" className="flex w-full items-center justify-between px-4 py-3"
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
              <SwapPanel />
            </div>
          )}
        </div>

        {/* ── Positions ─────────────────────────────────────── */}
        <div className="mt-4 rounded-xl border p-4"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Positions
            </h2>
            {positions.length > 0 && (
              <span className="font-mono text-xs font-semibold" style={{ color: pnlColor(totalPnl) }}>
                {totalPnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(totalPnl))}
              </span>
            )}
          </div>

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
                <span className="font-mono text-[10px]">
                  ({tab === "open" ? openPositions.length : settledPositions.length})
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {positionsLoading ? (
              <div className="col-span-full flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
              </div>
            ) : activeTab.length === 0 ? (
              <p className="col-span-full py-8 text-center font-body text-sm" style={{ color: "var(--text-3)" }}>
                {positionTab === "open" ? "No open positions yet." : "No settled positions yet."}
              </p>
            ) : (
              activeTab.map((p, i) => <PositionRow key={`${p.ticker}-${i}`} position={p} />)
            )}
          </div>
        </div>

        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 font-body text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowLeft className="h-3 w-3" /> Back to Terminal
        </Link>
      </main>

      {withdrawOpen && (
        <WithdrawModal solBalance={sol} solPrice={solPrice} onClose={() => setWithdrawOpen(false)} />
      )}
    </div>
  );
}
