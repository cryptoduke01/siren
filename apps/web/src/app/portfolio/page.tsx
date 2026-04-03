"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import Link from "next/link";
import {
  Shield, Loader2, ArrowLeft, Copy, Check,
  ChevronDown, ArrowUpRight, ArrowDownLeft, CreditCard,
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
  probability: number;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPct: number;
  status: string;
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
            <span>{p.quantity} shares</span>
            {settled && (
              <span className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)" }}>
                Settled
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold" style={{ color: pnlColor(p.pnlUsd) }}>
            {p.pnlUsd >= 0 ? "+" : ""}${fmtUsd(Math.abs(p.pnlUsd))}
          </p>
          <p className="font-mono text-[11px]" style={{ color: pnlColor(p.pnlPct) }}>
            {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-4 border-t pt-2 font-mono text-[11px]"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>
        <span>Entry ${fmtUsd(p.entryPrice)}</span>
        <span>{settled ? "Final" : "Current"} ${fmtUsd(p.currentPrice)}</span>
        <span>Prob {(p.probability * 100).toFixed(0)}%</span>
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

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [positionTab, setPositionTab] = useState<"open" | "settled">("open");
  const [proofLoading, setProofLoading] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;

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
  const totalPnl = positions.reduce((sum, p) => sum + p.pnlUsd, 0);

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
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-8">

        {/* ── Balance Card ──────────────────────────────────── */}
        <div className="rounded-xl border p-6"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <p className="font-body text-xs uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            Total Balance
          </p>
          {loading ? (
            <div className="mt-3 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
              <span className="font-body text-sm" style={{ color: "var(--text-3)" }}>Loading…</span>
            </div>
          ) : (
            <p className="mt-2 font-mono text-3xl font-bold" style={{ color: "var(--text-1)" }}>
              ${fmtUsd(totalUsd)}
            </p>
          )}

          {/* Action Buttons */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" onClick={handleDeposit} disabled={!connected}
              className="flex flex-col items-center gap-1.5 rounded-lg py-3 font-heading text-xs font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
              <CreditCard className="h-4 w-4" /> Deposit
            </button>
            <button type="button" disabled={!connected}
              onClick={() => { hapticLight(); setReceiveOpen(!receiveOpen); }}
              className="flex flex-col items-center gap-1.5 rounded-lg border py-3 font-heading text-xs font-semibold disabled:opacity-40"
              style={{
                borderColor: receiveOpen ? "var(--accent)" : "var(--border-subtle)",
                color: receiveOpen ? "var(--accent)" : "var(--text-1)",
              }}>
              <ArrowDownLeft className="h-4 w-4" /> Receive
            </button>
            <button type="button" disabled={!connected}
              onClick={() => { hapticLight(); setWithdrawOpen(true); }}
              className="flex flex-col items-center gap-1.5 rounded-lg border py-3 font-heading text-xs font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}>
              <ArrowUpRight className="h-4 w-4" /> Send
            </button>
          </div>

          {/* Receive Address */}
          {receiveOpen && walletKey && (
            <div className="mt-3 rounded-lg border p-3"
              style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
              <p className="mb-1.5 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                Send SOL or USDC to this address
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all break-all font-mono text-[11px]"
                  style={{ color: "var(--text-1)" }}>
                  {walletKey}
                </code>
                <button type="button" onClick={copyAddress}
                  className="shrink-0 rounded-md p-1.5 hover:bg-[var(--bg-elevated)]"
                  style={{ color: "var(--text-2)" }}>
                  {addressCopied
                    ? <Check className="h-3.5 w-3.5" style={{ color: "var(--up)" }} />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Token Balances */}
          <div className="mt-5 flex flex-col gap-2">
            <TokenRow symbol="SOL" balance={sol} usdValue={solUsd} />
            <TokenRow symbol="USDC" balance={usdc} usdValue={usdc} />
            <TokenRow symbol="USDT" balance={usdt} usdValue={usdt} />
          </div>
        </div>

        {/* ── Jupiter Swap ──────────────────────────────────── */}
        <div className="mt-4 overflow-hidden rounded-xl border"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <button type="button" className="flex w-full items-center justify-between px-4 py-3"
            onClick={() => { hapticLight(); setSwapOpen(!swapOpen); }}>
            <span className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Swap
            </span>
            <ChevronDown style={{ color: "var(--text-3)" }}
              className={`h-4 w-4 transition-transform duration-200 ${swapOpen ? "rotate-180" : ""}`} />
          </button>
          {swapOpen && (
            <iframe src="https://jup.ag/swap/SOL-USDC" title="Jupiter Swap"
              className="w-full border-t" allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              style={{ height: 500, borderColor: "var(--border-subtle)", background: "#131318" }} />
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

          {/* Tabs */}
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

          {/* Position List */}
          <div className="mt-3 flex flex-col gap-2">
            {positionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
              </div>
            ) : activeTab.length === 0 ? (
              <p className="py-8 text-center font-body text-sm" style={{ color: "var(--text-3)" }}>
                {positionTab === "open" ? "No open positions yet." : "No settled positions yet."}
              </p>
            ) : (
              activeTab.map((p, i) => <PositionRow key={`${p.ticker}-${i}`} position={p} />)
            )}
          </div>
        </div>

        {/* ── Identity ──────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: verified ? "var(--up)" : "var(--text-3)" }} />
            <span className="font-body text-sm"
              style={{ color: verified ? "var(--up)" : "var(--text-2)" }}>
              {verified ? "Verified" : "Not verified"}
            </span>
          </div>
          {!verified && connected && (
            <button type="button" onClick={openVerify} disabled={proofLoading}
              className="flex items-center gap-1 font-body text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--accent)" }}>
              {proofLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
            </button>
          )}
        </div>

        {/* ── Back ──────────────────────────────────────────── */}
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
