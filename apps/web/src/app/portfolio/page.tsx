"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import Link from "next/link";
import { Shield, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useToastStore } from "@/store/useToastStore";
import { hapticLight } from "@/lib/haptics";
import { fetchSolPriceUsd } from "@/lib/pricing";
import { useFundWallet as useSolanaFundWallet } from "@privy-io/react-auth/solana";
import { buildSolanaFundingConfig } from "@/lib/privyFunding";
import {
  buildProofDeepLink,
  buildProofMessage,
  buildProofRedirectUri,
  encodeProofSignature,
} from "@/lib/dflowProof";
import { API_URL } from "@/lib/apiUrl";

const LAMPORTS_PER_SOL = 1e9;
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtToken(n: number, decimals = 4): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

// ── Withdraw Modal ──────────────────────────────────────────────────

function WithdrawModal({
  solBalance,
  solPrice,
  onClose,
}: {
  solBalance: number;
  solPrice: number;
  onClose: () => void;
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
    if (!recipient.trim() || amt <= 0) {
      addToast("Enter a valid address and amount.", "error");
      return;
    }
    if (amt > solBalance) {
      addToast(`Insufficient SOL. Available: ${solBalance.toFixed(4)}`, "error");
      return;
    }

    let toPubkey: PublicKey;
    try {
      toPubkey = new PublicKey(recipient.trim());
    } catch {
      addToast("Invalid Solana address.", "error");
      return;
    }

    setSending(true);
    try {
      const lamports = BigInt(Math.floor(amt * LAMPORTS_PER_SOL));
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey,
          lamports,
        }),
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
    } finally {
      setSending(false);
    }
  };

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
          Withdraw SOL
        </h3>

        <label className="mt-4 block font-body text-xs" style={{ color: "var(--text-3)" }}>
          Recipient address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Solana address…"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
          style={{
            background: "var(--bg-base)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-1)",
          }}
        />

        <label className="mt-3 block font-body text-xs" style={{ color: "var(--text-3)" }}>
          Amount (SOL)
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min={0}
          step="any"
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
          style={{
            background: "var(--bg-base)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-1)",
          }}
        />
        <div className="mt-1 flex items-center justify-between font-body text-[11px]" style={{ color: "var(--text-3)" }}>
          <span>Available: {fmtToken(solBalance)} SOL</span>
          {usdEst > 0 && <span>≈ ${fmtUsd(usdEst)}</span>}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-heading text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--bg-base)" }}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 font-body text-sm"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Token Row ───────────────────────────────────────────────────────

function TokenRow({
  symbol,
  balance,
  usdValue,
}: {
  symbol: string;
  balance: number;
  usdValue: number;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
    >
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

// ── Page ────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { publicKey, signMessage, connected } = useSirenWallet();
  const { connection } = useConnection();
  const { fundWallet } = useSolanaFundWallet();
  const addToast = useToastStore((s) => s.addToast);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;

  // ── Balances ────────────────────────────────────────────────────

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["portfolio-balances", walletKey],
    queryFn: async () => {
      if (!publicKey) return { sol: 0, usdc: 0, usdt: 0 };

      const [lamports, usdcAccounts, usdtAccounts] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(SOLANA_USDC_MINT),
        }),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(SOLANA_USDT_MINT),
        }),
      ]);

      const extractUi = (accounts: typeof usdcAccounts): number =>
        accounts.value.reduce((sum, { account }) => {
          const parsed = account.data as {
            parsed?: { info?: { tokenAmount?: { uiAmount: number | null } } };
          };
          return sum + (parsed.parsed?.info?.tokenAmount?.uiAmount ?? 0);
        }, 0);

      return {
        sol: lamports / LAMPORTS_PER_SOL,
        usdc: extractUi(usdcAccounts),
        usdt: extractUi(usdtAccounts),
      };
    },
    enabled: !!publicKey,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const sol = balances?.sol ?? 0;
  const usdc = balances?.usdc ?? 0;
  const usdt = balances?.usdt ?? 0;

  // ── SOL Price ───────────────────────────────────────────────────

  const { data: solPrice = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: () => fetchSolPriceUsd(API_URL),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const solUsd = sol * solPrice;
  const totalUsd = solUsd + usdc + usdt;

  // ── Identity ────────────────────────────────────────────────────

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

  // ── Actions ─────────────────────────────────────────────────────

  const handleDeposit = useCallback(async () => {
    hapticLight();
    if (!publicKey) {
      addToast("Connect wallet first.", "error");
      return;
    }
    try {
      await fundWallet({ address: publicKey.toBase58(), options: buildSolanaFundingConfig() });
    } catch (err) {
      if (err instanceof Error && !err.message.includes("cancelled")) {
        addToast(err.message, "error");
      }
    }
  }, [publicKey, fundWallet, addToast]);

  const openVerify = useCallback(async () => {
    hapticLight();
    if (!publicKey || !signMessage) {
      addToast("Connect wallet to verify identity.", "error");
      return;
    }
    setProofLoading(true);
    try {
      const timestamp = Date.now();
      const message = buildProofMessage(timestamp);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = encodeProofSignature(sigBytes);
      const redirectUri = buildProofRedirectUri(
        `${window.location.origin}/portfolio`,
        publicKey.toBase58(),
      );
      const link = buildProofDeepLink({
        wallet: publicKey.toBase58(),
        signature,
        timestamp,
        redirectUri,
      });
      window.open(link, "_blank", "noopener,noreferrer");
      addToast("Verification opened in a new tab.", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Verification failed.", "error");
    } finally {
      setProofLoading(false);
    }
  }, [publicKey, signMessage, addToast]);

  // ── Render ──────────────────────────────────────────────────────

  const loading = !connected || balancesLoading;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        {/* Balance Card */}
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
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

          {/* Deposit + Withdraw */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleDeposit}
              disabled={!connected}
              className="flex-1 rounded-lg py-2.5 font-heading text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg-base)" }}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setWithdrawOpen(true); }}
              disabled={!connected}
              className="flex-1 rounded-lg border py-2.5 font-heading text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
            >
              Withdraw
            </button>
          </div>

          {/* Token Rows */}
          <div className="mt-5 flex flex-col gap-2">
            <TokenRow symbol="SOL" balance={sol} usdValue={solUsd} />
            <TokenRow symbol="USDC" balance={usdc} usdValue={usdc} />
            <TokenRow symbol="USDT" balance={usdt} usdValue={usdt} />
          </div>

          {/* Swap */}
          <a
            href="https://jup.ag/swap/SOL-USDC"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 font-body text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Swap on Jupiter <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Identity Row */}
        <div
          className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Shield
              className="h-4 w-4"
              style={{ color: verified ? "var(--up)" : "var(--text-3)" }}
            />
            <span
              className="font-body text-sm"
              style={{ color: verified ? "var(--up)" : "var(--text-2)" }}
            >
              {verified ? "Verified" : "Not verified"}
            </span>
          </div>
          {!verified && connected && (
            <button
              type="button"
              onClick={openVerify}
              disabled={proofLoading}
              className="flex items-center gap-1 font-body text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--accent)" }}
            >
              {proofLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Verify"
              )}
            </button>
          )}
        </div>

        {/* Back */}
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 font-body text-xs"
          style={{ color: "var(--text-3)" }}
        >
          <ArrowLeft className="h-3 w-3" /> Back to Terminal
        </Link>
      </main>

      {/* Withdraw Modal */}
      {withdrawOpen && (
        <WithdrawModal
          solBalance={sol}
          solPrice={solPrice}
          onClose={() => setWithdrawOpen(false)}
        />
      )}
    </div>
  );
}
