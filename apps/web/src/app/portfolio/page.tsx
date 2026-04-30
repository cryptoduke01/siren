"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import Link from "next/link";
import {
  Shield, Loader2, ArrowLeft, Copy, Check,
  ChevronDown, ArrowUp, CreditCard, Pencil, ArrowRightLeft, RefreshCw, Share2, Settings,
  QrCode, ScanLine, X,
} from "lucide-react";
import { Footer } from "@/components/Footer";
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
import { appendWalletAuthQuery, getWalletAuthHeaders } from "@/lib/requestAuth";
import { TradePnLCard } from "@/components/TradePnLCard";
import { useGoldRushWalletIntelligence } from "@/hooks/useGoldRushWalletIntelligence";
import { useTorqueRelayReadiness } from "@/hooks/useTorqueRelayReadiness";
import {
  getPositionEntry,
  setPositionEntry,
  pnlFromAvgEntry,
  markCentsForSide,
} from "@/lib/positionEntryStorage";
import {
  buildLocalPositionStatsMap,
  pushLocalTrade,
  readLocalTrades,
  type LocalPositionStat,
  type LocalTradeLedgerRow,
} from "@/lib/localTradeLedger";
import { toDataURL } from "qrcode";
import type { GoldRushWalletIntelligence } from "@/hooks/useGoldRushWalletIntelligence";

const LAMPORTS_PER_SOL = 1e9;
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL_TRANSFER_RESERVE_SOL = 0.005;
const COVALENT_LOGO_URL = "https://res.cloudinary.com/dgvnuwspr/image/upload/v1775164758/earn-sponsor/y6xef0r0sn6mnhsdfql7.webp";
const TORQUE_LOGO_URL = "https://res.cloudinary.com/dgvnuwspr/image/upload/v1740506157/rsp3uxahzczpcbr78gaz.png";

type TransferAssetOption = {
  key: string;
  symbol: string;
  name: string;
  kind: "native" | "spl";
  mint?: string;
  decimals: number;
  balance: number;
  usdValue?: number | null;
  hint?: string | null;
};

type PortfolioActivityItem = {
  id: string;
  ts: number;
  title: string;
  detail: string;
  amountLabel?: string | null;
  tone?: "neutral" | "up" | "down";
  kind: "send" | "receive" | "swap" | "prediction" | "close";
};

function formatCompactUsd(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatAddressShort(value?: string | null, chars = 4): string {
  if (!value) return "Unknown";
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function getActivityToneColor(tone?: PortfolioActivityItem["tone"]): string {
  if (tone === "up") return "var(--up)";
  if (tone === "down") return "var(--down)";
  return "var(--text-1)";
}

function buildReceiveQrValue(walletKey: string): string {
  return `solana:${walletKey}`;
}

function extractRecipientFromQrPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(trimmed)) return trimmed;
  const sanitized = trimmed.replace(/^solana:/iu, "").replace(/^\/\//u, "");
  const address = sanitized.split(/[?&#]/u)[0]?.trim();
  if (address && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(address)) return address;
  return null;
}

function ProviderBadge({
  src,
  alt,
  eyebrow,
  status,
}: {
  src: string;
  alt: string;
  eyebrow: string;
  status: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border px-3 py-2"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
    >
      <img src={src} alt={alt} className="h-6 w-auto rounded-full bg-white/95 object-contain px-1 py-0.5" />
      <div className="min-w-0">
        <p className="font-sub text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
          {eyebrow}
        </p>
        <p className="font-heading text-[11px] font-semibold" style={{ color: "var(--text-1)" }}>
          {status}
        </p>
      </div>
    </div>
  );
}

interface Position {
  ticker: string;
  title: string;
  side: string;
  decimals?: number;
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
  closeTime?: number;
  marketStatus?: string;
  outcomeLabel?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  settledReason?: "closed_position" | "market_closed" | "history_only" | null;
}

type PositionsQueryData = {
  positions: Position[];
  stale?: boolean;
  updatedAt?: string;
  degradedReason?: string;
};

function resolvePositionAvgEntryCents(
  p: Position,
  localStat?: LocalPositionStat | null,
): number | null {
  const savedEntry = p.mint ? getPositionEntry(p.mint) : null;
  if (savedEntry) return savedEntry.avgCents;
  if (localStat?.avgEntryCents != null && Number.isFinite(localStat.avgEntryCents)) {
    return localStat.avgEntryCents;
  }
  if (typeof p.entryPrice === "number" && Number.isFinite(p.entryPrice) && p.entryPrice >= 0) {
    return p.entryPrice;
  }
  return null;
}

function computePositionPnl(p: Position, localStat?: LocalPositionStat | null): { usd: number; pct: number } {
  if (p.status === "settled" && typeof p.pnlUsd === "number" && Number.isFinite(p.pnlUsd)) {
    return { usd: p.pnlUsd, pct: p.pnlPct ?? 0 };
  }
  const shares = p.quantity ?? p.balance ?? 0;
  const avgEntryCents = resolvePositionAvgEntryCents(p, localStat);
  if (avgEntryCents != null && shares > 0) {
    const { pnlUsd, pnlPct } = pnlFromAvgEntry({
      side: p.side,
      probability: p.probability,
      shares,
      avgCents: avgEntryCents,
    });
    return { usd: pnlUsd, pct: pnlPct };
  }
  return { usd: p.pnlUsd ?? 0, pct: p.pnlPct ?? 0 };
}

const fmtUsd = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtToken = (n: number, d = 4) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });

const pnlColor = (n: number) =>
  n > 0 ? "var(--up)" : n < 0 ? "var(--down)" : "var(--text-3)";

function formatPresetAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value
    .toFixed(Math.min(Math.max(decimals, 0), 6))
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .replace(/\.$/u, "");
}

function parseAmountToAtomic(amountStr: string, decimals: number): bigint {
  const raw = amountStr.trim();
  if (!raw) return BigInt(0);
  const [wholePart, fracPartRaw = ""] = raw.split(".");
  const whole = wholePart ? BigInt(wholePart) : BigInt(0);
  const fracDigits = fracPartRaw.replace(/[^0-9]/g, "");
  const fracTrunc = fracDigits.slice(0, decimals);
  const fracPadded = fracTrunc.padEnd(decimals, "0");
  const frac = fracPadded ? BigInt(fracPadded) : BigInt(0);
  const scale = BigInt(10) ** BigInt(decimals);
  return whole * scale + frac;
}

function normalizePositionCloseTime(closeTime?: number | null): number | null {
  if (closeTime == null || !Number.isFinite(closeTime)) return null;
  return closeTime < 1_000_000_000_000 ? Math.round(closeTime * 1000) : Math.round(closeTime);
}

function formatPositionDateLabel(value?: number | string | null): string | null {
  if (value == null) return null;
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPositionEndLabel(closeTime?: number | null, marketStatus?: string | null): string | null {
  const closeMs = normalizePositionCloseTime(closeTime);
  if (closeMs == null) return null;
  const closed = closeMs <= Date.now() || ["closed", "settled", "resolved", "expired"].includes((marketStatus || "").toLowerCase());
  const label = formatPositionDateLabel(closeMs);
  if (!label) return null;
  return `${closed ? "Ended" : "Ends"} ${label}`;
}

// ── Withdraw Modal ──────────────────────────────────────────────────

function WithdrawModal({
  assets,
  solBalance,
  solPrice,
  onClose,
}: {
  assets: TransferAssetOption[];
  solBalance: number;
  solPrice: number;
  onClose: () => void;
}) {
  const { publicKey, signTransaction, signMessage } = useSirenWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const showResultModal = useResultModalStore((s) => s.show);
  const spendableAssets = useMemo(() => assets.filter((asset) => asset.balance > 0), [assets]);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(() => spendableAssets[0]?.key ?? assets[0]?.key ?? "SOL");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const activeList = spendableAssets.length > 0 ? spendableAssets : assets;
    if (!activeList.some((asset) => asset.key === selectedAssetKey)) {
      setSelectedAssetKey(activeList[0]?.key ?? "SOL");
    }
  }, [assets, selectedAssetKey, spendableAssets]);

  const selectedAsset = useMemo(
    () => [...spendableAssets, ...assets].find((asset) => asset.key === selectedAssetKey) ?? spendableAssets[0] ?? assets[0] ?? null,
    [assets, selectedAssetKey, spendableAssets],
  );
  const spendableBalance = selectedAsset
    ? selectedAsset.kind === "native"
      ? Math.max(0, selectedAsset.balance - SOL_TRANSFER_RESERVE_SOL)
      : selectedAsset.balance
    : 0;
  const amountNum = parseFloat(amount) || 0;
  const unitUsd =
    selectedAsset?.balance && selectedAsset.usdValue != null
      ? selectedAsset.usdValue / selectedAsset.balance
      : selectedAsset?.symbol === "SOL"
        ? solPrice
        : null;
  const usdEst = amountNum > 0 && unitUsd != null ? amountNum * unitUsd : null;

  const handlePreset = (fraction: number) => {
    if (!selectedAsset) return;
    setAmount(formatPresetAmount(spendableBalance * fraction, selectedAsset.decimals));
  };

  const handlePasteRecipient = useCallback(async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (!pasted.trim()) return;
      const normalized = extractRecipientFromQrPayload(pasted) ?? pasted.trim();
      setRecipient(normalized);
    } catch {
      showResultModal({
        type: "error",
        title: "Clipboard unavailable",
        message: "Paste the recipient address manually on this device.",
      });
    }
  }, [showResultModal]);

  const handleScanRecipient = useCallback(async (file?: File | null) => {
    if (!file) return;
    setScanLoading(true);
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const decoded = await QrScanner.scanImage(file, {
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true,
      });
      const payload = typeof decoded === "string" ? decoded : decoded.data;
      const normalized = extractRecipientFromQrPayload(payload);
      if (!normalized) {
        throw new Error("The QR code did not contain a valid Solana address.");
      }
      setRecipient(normalized);
    } catch (err) {
      showResultModal({
        type: "error",
        title: "QR scan failed",
        message: err instanceof Error ? err.message : "We could not read a Solana address from that QR code.",
      });
    } finally {
      setScanLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [showResultModal]);

  const handleSend = async () => {
    if (!publicKey || !signTransaction || !selectedAsset) return;
    if (!recipient.trim() || amountNum <= 0) {
      showResultModal({ type: "error", title: "Send asset", message: "Enter a valid recipient address and amount." });
      return;
    }
    if (selectedAsset.kind === "native") {
      if (amountNum > spendableBalance + 1e-9) {
        showResultModal({
          type: "error",
          title: "Insufficient SOL",
          message: `Keep at least ${SOL_TRANSFER_RESERVE_SOL.toFixed(3)} SOL for fees. You can send up to ${fmtToken(spendableBalance, 4)} SOL right now.`,
        });
        return;
      }
    } else {
      if (amountNum > selectedAsset.balance + 1e-9) {
        showResultModal({
          type: "error",
          title: `Insufficient ${selectedAsset.symbol}`,
          message: `You have ${fmtToken(selectedAsset.balance, selectedAsset.decimals === 9 ? 6 : 4)} ${selectedAsset.symbol} available.`,
        });
        return;
      }
      if (solBalance < SOL_TRANSFER_RESERVE_SOL) {
        showResultModal({
          type: "error",
          title: "SOL needed for fees",
          message: `Keep at least ${SOL_TRANSFER_RESERVE_SOL.toFixed(3)} SOL in this wallet before sending ${selectedAsset.symbol}.`,
        });
        return;
      }
    }

    let toPubkey: PublicKey;
    try {
      toPubkey = new PublicKey(recipient.trim());
    } catch {
      showResultModal({ type: "error", title: "Invalid address", message: "That does not look like a valid Solana address." });
      return;
    }

    setSending(true);
    try {
      const tx = new Transaction();

      if (selectedAsset.kind === "native") {
        const lamports = BigInt(Math.floor(amountNum * LAMPORTS_PER_SOL));
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey, lamports }));
      } else {
        if (!selectedAsset.mint) {
          throw new Error("This asset is missing its mint address.");
        }
        const mintPubkey = new PublicKey(selectedAsset.mint);
        const senderAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: mintPubkey }, "confirmed");
        const senderAccount = senderAccounts.value.find(({ account }) => {
          const parsed = account.data as {
            parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } };
          };
          return (parsed.parsed?.info?.tokenAmount?.uiAmount ?? 0) > 0;
        });
        if (!senderAccount) {
          throw new Error(`No ${selectedAsset.symbol} account with balance was found in this wallet.`);
        }

        const tokenProgramId = senderAccount.account.owner;
        const senderTokenAccount = senderAccount.pubkey;
        const recipientAta = getAssociatedTokenAddressSync(mintPubkey, toPubkey, false, tokenProgramId);
        const recipientAtaInfo = await connection.getAccountInfo(recipientAta, "confirmed");
        if (!recipientAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              recipientAta,
              toPubkey,
              mintPubkey,
              tokenProgramId,
            ),
          );
        }

        const atomicAmount = parseAmountToAtomic(amount, selectedAsset.decimals);
        if (atomicAmount <= BigInt(0)) {
          throw new Error("Enter a valid amount to send.");
        }
        tx.add(
          createTransferInstruction(
            senderTokenAccount,
            recipientAta,
            publicKey,
            atomicAmount,
            [],
            tokenProgramId,
          ),
        );
      }

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = publicKey;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      showResultModal({
        type: "success",
        title: `${selectedAsset.symbol} sent`,
        message: `Sent ${formatPresetAmount(amountNum, selectedAsset.decimals)} ${selectedAsset.symbol} from your wallet.`,
        txSignature: sig,
      });
      pushLocalTrade(publicKey.toBase58(), {
        ts: Date.now(),
        mint: selectedAsset.mint ?? selectedAsset.key,
        side: "sell",
        solAmount: selectedAsset.kind === "native" ? amountNum : 0,
        tokenAmount: amountNum,
        priceUsd: unitUsd ?? 0,
        amountUsd: usdEst ?? undefined,
        tokenName: selectedAsset.name,
        tokenSymbol: selectedAsset.symbol,
        txSignature: sig,
        counterparty: toPubkey.toBase58(),
        note: selectedAsset.kind === "native" ? "Native transfer" : "Token transfer",
        activityKind: "send",
        fromSymbol: selectedAsset.symbol,
        toSymbol: selectedAsset.symbol,
      });
      const approxVolumeSol =
        selectedAsset.kind === "native"
          ? amountNum
          : usdEst != null && solPrice > 0
            ? usdEst / solPrice
            : null;
      if (approxVolumeSol != null && Number.isFinite(approxVolumeSol) && approxVolumeSol > 0) {
        void (async () => {
          try {
            const authHeaders = await getWalletAuthHeaders({ wallet: publicKey.toBase58(), signMessage, scope: "write" });
            await fetch(`${API_URL}/api/volume/log`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol: approxVolumeSol }),
            });
          } catch {
            /* ignore volume telemetry failures */
          }
        })();
      }
      queryClient.invalidateQueries({ queryKey: ["portfolio-balances"] });
      queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["dflow-positions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-tokens", publicKey.toBase58()] });
      onClose();
    } catch (err) {
      showResultModal({
        type: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Could not complete the transfer.",
      });
    } finally {
      setSending(false);
    }
  };

  const amountPanelStyle = {
    background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--bg-base)), var(--bg-base))",
    borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[30px] border bg-[var(--bg-surface)] md:max-h-[92vh] md:max-w-5xl md:rounded-[32px]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void handleScanRecipient(event.target.files?.[0])}
        />

        <div className="flex items-start justify-between gap-4 border-b px-4 py-4 md:px-6" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="min-w-0">
            <p className="font-sub text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Send
            </p>
            <h3 className="mt-1 font-heading text-[1.85rem] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-1)" }}>
              Move assets from this wallet
            </h3>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
              Enter the amount, confirm what is available, see the live USD estimate, then paste or scan the recipient before sending.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-2)" }}
            aria-label="Close send modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {spendableAssets.length === 0 ? (
          <div className="m-4 rounded-2xl border px-5 py-8 text-center md:m-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
              No transferable balance yet
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
              Fund the wallet first, then come back here to send SOL, stables, or outcome tokens.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
              <div className="space-y-4">
                <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Asset
                      </p>
                      <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                        Choose the balance you want to move out.
                      </p>
                    </div>
                    <span className="rounded-full border px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>
                      {spendableAssets.length} live
                    </span>
                  </div>
                  <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1">
                    {spendableAssets.map((asset) => {
                      const active = asset.key === selectedAssetKey;
                      return (
                        <button
                          key={asset.key}
                          type="button"
                        onClick={() => {
                          hapticLight();
                          setSelectedAssetKey(asset.key);
                          setAmount("");
                        }}
                        className="min-w-[180px] snap-start rounded-[22px] border p-4 text-left transition-all"
                        style={{
                          borderColor: active ? "color-mix(in srgb, var(--accent) 44%, transparent)" : "var(--border-subtle)",
                          background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                              {asset.symbol}
                            </p>
                            <p className="mt-1 truncate font-body text-xs" style={{ color: "var(--text-2)" }}>
                              {asset.name}
                            </p>
                            {asset.hint && (
                              <p className="mt-1 truncate font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                                {asset.hint}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-money text-base font-semibold tabular-nums" style={{ color: active ? "var(--accent)" : "var(--text-1)" }}>
                              {fmtToken(asset.balance, asset.decimals === 9 ? 4 : 2)}
                            </p>
                            {asset.usdValue != null && (
                              <p className="mt-1 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                                {formatCompactUsd(asset.usdValue)}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  </div>
                </div>

                <div className="rounded-[26px] border p-4 md:p-5" style={amountPanelStyle}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Amount
                      </p>
                      <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                        Available: {selectedAsset ? fmtToken(spendableBalance, selectedAsset.decimals === 9 ? 4 : 2) : "0"} {selectedAsset?.symbol ?? ""}
                      </p>
                    </div>
                    {usdEst != null && (
                      <span className="rounded-full border px-3 py-1 font-money text-xs tabular-nums" style={{ borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)", color: "var(--accent)" }}>
                        {formatCompactUsd(usdEst)}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-end gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      spellCheck={false}
                      className="min-w-0 flex-1 bg-transparent font-money text-[clamp(2rem,8vw,3.75rem)] font-bold tabular-nums outline-none placeholder:text-[var(--text-3)]"
                      style={{ color: "var(--text-1)" }}
                    />
                    <span className="mb-1 shrink-0 font-heading text-xl font-semibold" style={{ color: "var(--text-2)" }}>
                      {selectedAsset?.symbol ?? "Asset"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {[0.25, 0.5, 0.75, 1].map((fraction) => (
                      <button
                        key={fraction}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          handlePreset(fraction);
                        }}
                        className="min-h-11 rounded-2xl border px-3 py-2 font-heading text-xs font-semibold transition-all"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
                      >
                        {fraction === 1 ? "Max" : `${Math.round(fraction * 100)}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <label htmlFor="send-recipient" className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Recipient
                      </label>
                      <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                        Paste a Solana wallet address or scan a QR code from another wallet.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handlePasteRecipient()}
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 font-heading text-xs font-semibold"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-1)" }}
                      >
                        <Copy className="h-4 w-4" />
                        Paste
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanLoading}
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 font-heading text-xs font-semibold disabled:opacity-60"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-1)" }}
                      >
                        {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                        Scan QR
                      </button>
                    </div>
                  </div>
                  <input
                    id="send-recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Paste wallet address"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-4 min-h-14 w-full rounded-[20px] border px-4 py-3 font-label text-sm outline-none"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Send preview
                      </p>
                      <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                        A quick read before you sign.
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em]"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-3)" }}
                    >
                      Solana mainnet
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                        Asset
                      </p>
                      <p className="mt-1 font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                        {selectedAsset?.name ?? "Asset"}
                      </p>
                      <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                        {selectedAsset?.symbol} · {selectedAsset?.hint || "Transfer on Solana"}
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                        Recipient
                      </p>
                      <p className="mt-1 font-label text-sm" style={{ color: "var(--text-1)" }}>
                        {recipient.trim() ? formatAddressShort(recipient.trim(), 6) : "Not set yet"}
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                        Network + fee note
                      </p>
                      <p className="mt-1 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {selectedAsset?.kind === "native"
                          ? `SOL transfers keep ${SOL_TRANSFER_RESERVE_SOL.toFixed(3)} SOL back for network fees.`
                          : `SPL transfers still need a little SOL for fees and may create the recipient's token account on first receive.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Transfer note
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    Siren shows the live balance you can safely move right now. For SOL, the app keeps a fee buffer so you do not strand the wallet.
                  </p>
                  {selectedAsset?.hint && (
                    <p className="mt-3 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                      {selectedAsset.hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row md:px-6" style={{ borderColor: "var(--border-subtle)" }}>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || spendableAssets.length === 0 || !selectedAsset}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-heading text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--bg-base)" }}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send {selectedAsset?.symbol ?? "asset"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-2xl border px-5 py-3.5 font-body text-sm"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositModal({
  walletKey,
  assets,
  onClose,
  onFund,
  addressCopied,
  onCopyAddress,
  loading,
}: {
  walletKey: string;
  assets: TransferAssetOption[];
  onClose: () => void;
  onFund: () => Promise<void> | void;
  addressCopied: boolean;
  onCopyAddress: () => void;
  loading: boolean;
}) {
  const defaultReceiveKey = assets.find((asset) => asset.symbol === "USDC")?.key ?? assets[0]?.key ?? "USDC";
  const [selectedAssetKey, setSelectedAssetKey] = useState(defaultReceiveKey);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assets.some((asset) => asset.key === selectedAssetKey)) {
      setSelectedAssetKey(defaultReceiveKey);
    }
  }, [assets, defaultReceiveKey, selectedAssetKey]);

  useEffect(() => {
    let cancelled = false;
    void toDataURL(buildReceiveQrValue(walletKey), {
      margin: 1,
      width: 320,
      color: {
        dark: "#11131a",
        light: "#f7f3e7",
      },
    })
      .then((value: string) => {
        if (!cancelled) setQrDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [walletKey]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.key === selectedAssetKey) ?? assets[0] ?? null,
    [assets, selectedAssetKey],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[30px] border bg-[var(--bg-surface)] md:max-h-[92vh] md:max-w-5xl md:rounded-[32px]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-4 py-4 md:px-6" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="min-w-0">
            <p className="font-sub text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Receive
            </p>
            <h3 className="mt-1 font-heading text-[1.85rem] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-1)" }}>
              Top up this trading wallet
            </h3>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
              Buy USDC with card, or share this wallet address and QR code so someone can send the exact Solana asset you want.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-2)" }}
            aria-label="Close receive modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_360px]">
            <div className="space-y-4">
              <button
                type="button"
                onClick={onFund}
                disabled={loading}
                className="w-full rounded-[26px] border p-5 text-left transition-colors disabled:opacity-50"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)",
                  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 11%, var(--bg-surface)), var(--bg-base))",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                      Buy USDC with card
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      Apple Pay may appear when supported by Privy. This is still the fastest way to fund the trading wallet from inside Siren.
                    </p>
                  </div>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} /> : <CreditCard className="h-5 w-5" style={{ color: "var(--accent)" }} />}
                </div>
              </button>

              <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                      Asset to receive
                    </p>
                    <p className="mt-1 font-sub text-xs" style={{ color: "var(--text-3)" }}>
                      One Solana wallet address, multiple supported assets.
                    </p>
                  </div>
                  <span
                    className="rounded-full border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em]"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-3)" }}
                  >
                    Solana mainnet
                  </span>
                </div>
                <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1">
                  {assets.map((asset) => {
                    const active = asset.key === selectedAssetKey;
                    return (
                      <button
                        key={asset.key}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setSelectedAssetKey(asset.key);
                        }}
                        className="min-w-[180px] snap-start rounded-[22px] border p-4 text-left transition-all"
                        style={{
                          borderColor: active ? "color-mix(in srgb, var(--accent) 44%, transparent)" : "var(--border-subtle)",
                          background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                        }}
                      >
                        <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                          {asset.symbol}
                        </p>
                        <p className="mt-1 truncate font-body text-xs" style={{ color: "var(--text-2)" }}>
                          {asset.name}
                        </p>
                        {asset.hint && (
                          <p className="mt-1 truncate font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                            {asset.hint}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className="rounded-[26px] border p-4 md:p-5"
                style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--bg-base)), var(--bg-base))", borderColor: "color-mix(in srgb, var(--accent) 20%, var(--border-subtle))" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                      Receive {selectedAsset?.symbol ?? "asset"}
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {selectedAsset?.kind === "native"
                        ? "Send native SOL on Solana to this wallet address."
                        : `Send ${selectedAsset?.symbol} on Solana to this same wallet address.`}
                    </p>
                  </div>
                  <QrCode className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>

                <div className="mt-4 flex items-center justify-center rounded-[24px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR code for ${walletKey}`} className="h-52 w-52 rounded-[20px]" />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center rounded-[20px] border" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-3)" }} />
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Wallet address
                      </p>
                      <code className="mt-2 block select-all break-all font-label text-xs leading-relaxed" style={{ color: "var(--text-1)" }}>
                        {walletKey}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={onCopyAddress}
                      className="shrink-0 rounded-xl border p-2.5 transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
                      aria-label="Copy wallet address"
                    >
                      {addressCopied ? <Check className="h-4 w-4" style={{ color: "var(--up)" }} /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border p-4 md:p-5" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  Funding hint
                </p>
                <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  Use this address for SOL, USDC, USDT, or open outcome tokens on Solana. The address stays the same even when you switch the selected asset above.
                </p>
                {selectedAsset?.hint && (
                  <p className="mt-3 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                    {selectedAsset.hint}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row md:px-6" style={{ borderColor: "var(--border-subtle)" }}>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-2xl border px-5 py-3.5 font-body text-sm"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
          >
            Close
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

const MINT_SYMBOL: Record<string, string> = Object.fromEntries(SWAP_TOKENS.map((t) => [t.mint, t.symbol]));

function symbolForMint(mint: string): string {
  return MINT_SYMBOL[mint] ?? `${mint.slice(0, 4)}…`;
}

function buildLocalActivityItem(row: LocalTradeLedgerRow): PortfolioActivityItem {
  const symbol = row.tokenSymbol?.trim() || symbolForMint(row.mint);
  const label = row.tokenName?.trim() || symbol;
  const amountUsd = row.amountUsd ?? row.stakeUsd ?? (row.priceUsd > 0 && row.tokenAmount > 0 ? row.priceUsd * row.tokenAmount : null);

  if (row.activityKind === "send") {
    return {
      id: row.txSignature || `${row.ts}-${row.mint}-send`,
      ts: row.ts,
      kind: "send",
      title: `Sent ${symbol}`,
      detail: row.counterparty ? `To ${formatAddressShort(row.counterparty, 6)}` : row.note || "Outgoing transfer",
      amountLabel: `${fmtToken(row.tokenAmount, row.tokenAmount >= 1 ? 2 : 4)} ${symbol}`,
      tone: "down",
    };
  }

  if (row.activityKind === "close" || row.side === "sell") {
    return {
      id: row.txSignature || `${row.ts}-${row.mint}-close`,
      ts: row.ts,
      kind: "close",
      title: "Closed position",
      detail: label,
      amountLabel: amountUsd != null ? formatCompactUsd(amountUsd) : `${fmtToken(row.tokenAmount, row.tokenAmount >= 1 ? 2 : 4)} shares`,
      tone: amountUsd != null && amountUsd > 0 ? "up" : "neutral",
    };
  }

  if (row.activityKind === "swap") {
    return {
      id: row.txSignature || `${row.ts}-${row.mint}-swap`,
      ts: row.ts,
      kind: "swap",
      title: `Swapped ${row.fromSymbol || "asset"} to ${row.toSymbol || symbol}`,
      detail: row.note || `${fmtToken(row.tokenAmount, row.tokenAmount >= 1 ? 2 : 4)} ${symbol} received`,
      amountLabel: amountUsd != null ? formatCompactUsd(amountUsd) : null,
      tone: "neutral",
    };
  }

  return {
    id: row.txSignature || `${row.ts}-${row.mint}-prediction`,
    ts: row.ts,
    kind: "prediction",
    title: row.activityKind === "prediction" ? "Opened prediction position" : `Bought ${symbol}`,
    detail: label,
    amountLabel:
      row.stakeUsd != null && row.stakeUsd > 0
        ? `${formatCompactUsd(row.stakeUsd)} for ~${fmtToken(row.tokenAmount, 2)} shares`
        : `${fmtToken(row.tokenAmount, row.tokenAmount >= 1 ? 2 : 4)} ${symbol}`,
    tone: "up",
  };
}

function buildWalletFlowActivityItem(
  item: GoldRushWalletIntelligence["activity"][number],
): PortfolioActivityItem {
  const parsedTs = item.timestamp ? Date.parse(item.timestamp) : Number.NaN;
  const tone = item.direction === "in" ? "up" : item.direction === "out" ? "down" : "neutral";
  const title =
    item.direction === "in"
      ? "Received funds"
      : item.direction === "out"
        ? "Sent funds"
        : item.direction === "self"
          ? "Moved funds"
          : "Wallet movement";

  return {
    id: item.txHash,
    ts: Number.isFinite(parsedTs) ? parsedTs : Date.now(),
    kind: item.direction === "in" ? "receive" : "send",
    title,
    detail: item.explorerUrl ? `Tracked on-chain via Covalent · ${formatAddressShort(item.txHash, 6)}` : "Tracked on-chain via Covalent",
    amountLabel: item.prettyValueUsd || formatCompactUsd(item.valueUsd),
    tone,
  };
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
  const { publicKey, signTransaction, signMessage } = useSirenWallet();
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

      void (async () => {
        try {
          const authHeaders = await getWalletAuthHeaders({ wallet: publicKey.toBase58(), signMessage, scope: "write" });
          await fetch(`${API_URL}/api/volume/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ wallet: publicKey.toBase58(), volumeSol: parseFloat(amount) }),
          });
        } catch {
          /* ignore telemetry auth failures */
        }
      })();

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
        amountUsd: fromToken.symbol === "USDC" || fromToken.symbol === "USDT" ? amtNum : undefined,
        tokenName: `${fromToken.symbol} → ${toToken.symbol}`,
        tokenSymbol: toToken.symbol,
        fromSymbol: fromToken.symbol,
        toSymbol: toToken.symbol,
        note: `${fmtToken(amtNum, 4)} ${fromToken.symbol} routed into ${toToken.symbol}`,
        activityKind: "swap",
        txSignature: typeof result.signature === "string" ? result.signature : `swap-${Date.now()}`,
      });
      void (async () => {
        try {
          const authHeaders = await getWalletAuthHeaders({ wallet: publicKey.toBase58(), signMessage, scope: "write" });
          await fetch(`${API_URL}/api/trades/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
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
          });
        } catch {
          /* ignore telemetry auth failures */
        }
      })();
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

function PositionRow({
  position: p,
  localStat,
  onEntrySaved,
}: {
  position: Position;
  localStat?: LocalPositionStat | null;
  onEntrySaved: () => void;
}) {
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
  const displayOutcomeLabel = p.outcomeLabel?.trim() || p.side?.toUpperCase() || "Position";
  const readsLikeSideLabel = displayOutcomeLabel.toLowerCase() === (p.side?.toLowerCase() || "");
  const outcomeChipLabel = readsLikeSideLabel ? displayOutcomeLabel : `Outcome · ${displayOutcomeLabel}`;
  const sideChipLabel = !readsLikeSideLabel ? `${p.side?.toUpperCase()} side` : null;
  const endLabel = formatPositionEndLabel(p.closeTime, p.marketStatus);
  const openedLabel = formatPositionDateLabel(p.openedAt);
  const closedLabel = formatPositionDateLabel(p.closedAt);
  const settledBadgeLabel =
    p.settledReason === "closed_position" ? "Closed early" : p.settledReason === "market_closed" ? "Market ended" : "Settled";
  const resultLabel =
    !settled
      ? "Live PnL"
      : p.settledReason === "closed_position"
        ? "Closed result"
        : p.settledReason === "market_closed"
          ? "Ended result"
          : "Settled result";
  const current = p.currentPriceUsd ?? p.currentPrice ?? (prob > 1 ? prob / 100 : prob);
  const kalshiUrl = p.kalshi_url || `https://kalshi.com/markets/${p.ticker?.toLowerCase()}`;
  const markCents = markCentsForSide(p.side, p.probability);
  const savedEntry = p.mint ? getPositionEntry(p.mint) : null;
  const autoAvgCents =
    savedEntry?.avgCents == null
      ? localStat?.avgEntryCents ?? (typeof p.entryPrice === "number" && Number.isFinite(p.entryPrice) ? p.entryPrice : null)
      : null;
  const draftParsed = avgCentsDraft.trim() === "" ? Number.NaN : parseFloat(avgCentsDraft);
  const draftAvg =
    Number.isFinite(draftParsed) && draftParsed >= 0 && draftParsed <= 100 ? draftParsed : null;
  const baseAvgCents = resolvePositionAvgEntryCents(p, localStat);
  const avgCentsForPnl = draftAvg ?? baseAvgCents;
  const fromLocalAvg =
    avgCentsForPnl != null && shares > 0
      ? pnlFromAvgEntry({
          side: p.side,
          probability: p.probability,
          shares,
          avgCents: avgCentsForPnl,
        })
      : null;
  const apiPnl = computePositionPnl(p, localStat);
  const pnl = fromLocalAvg != null ? fromLocalAvg.pnlUsd : apiPnl.usd;
  const pnlPct = fromLocalAvg != null ? fromLocalAvg.pnlPct : apiPnl.pct;
  const pnlIsPreview =
    draftAvg != null && (baseAvgCents == null || Math.abs(draftAvg - baseAvgCents) > 1e-6);
  const stakeForCard =
    avgCentsForPnl != null && shares > 0 ? (shares * avgCentsForPnl) / 100 : null;
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
        symbol: displayOutcomeLabel,
        price: typeof current === "number" ? current : prob > 1 ? prob / 100 : prob,
        assetType: "prediction",
        decimals: p.decimals,
        entryPrice: baseAvgCents ?? undefined,
        marketTicker: p.ticker,
        marketTitle: p.title,
        marketSide,
        marketOutcomeLabel: p.outcomeLabel ?? undefined,
        marketProbability: probPct,
        marketCloseTime: p.closeTime,
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
  const settledSummary = settled
    ? p.settledReason === "closed_position"
      ? `${readsLikeSideLabel ? "You closed this position" : `Outcome held: ${displayOutcomeLabel}. You closed it`} before settlement${closedLabel ? ` on ${closedLabel}` : ""}.`
      : `${readsLikeSideLabel ? endLabel ?? "Market ended" : `Outcome held: ${displayOutcomeLabel}. ${endLabel ?? "Market ended"}`}${valueUsdDisplay != null ? ` We last tracked it near $${fmtUsd(valueUsdDisplay)} total.` : "."}`
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
              className="rounded-md px-2 py-0.5 font-heading text-[11px] font-semibold"
              style={{
                background: p.side === "yes" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                color: p.side === "yes" ? "var(--up)" : "var(--down)",
              }}
            >
              {outcomeChipLabel}
            </span>
            <span>{shares.toFixed(shares >= 1 ? 0 : 2)} shares</span>
            {sideChipLabel && (
              <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                {sideChipLabel}
              </span>
            )}
            {endLabel && <span>{endLabel}</span>}
            {openedLabel && !settled && <span>Opened {openedLabel}</span>}
            {closedLabel && settled && <span>Closed {closedLabel}</span>}
            {settled && (
              <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                {settledBadgeLabel}
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
              {resultLabel}
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
          {settledSummary ?? `About ${markCents.toFixed(0)}¢ per share right now${valueUsdDisplay != null ? ` (~$${fmtUsd(valueUsdDisplay)} total)` : ""}.`}
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
            {autoAvgCents != null
              ? `Using your logged Siren trades at about ${autoAvgCents.toFixed(1)}¢ per share. Save a manual price only if you opened this position elsewhere or want to override it on this device.`
              : "To estimate profit or loss, enter what you paid per share in cents (for example 20), then Save. We do not see your outside Kalshi history automatically."}
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
                placeholder={savedEntry ? String(savedEntry.avgCents) : autoAvgCents != null ? autoAvgCents.toFixed(1) : "e.g. 20"}
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
            {!savedEntry && autoAvgCents != null && (
              <span
                className="rounded-full border px-3 py-1 font-heading text-xs font-semibold self-center"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
              >
                Auto @ {autoAvgCents.toFixed(1)}¢
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
            href="/terminal"
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
              token={{ name: p.title || p.ticker, symbol: displayOutcomeLabel }}
              profitUsd={pnl}
              percent={pnlPct}
              kalshiMarket={p.title || p.ticker}
              marketLabel={p.title || p.ticker}
              positionLabel={displayOutcomeLabel}
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

  const localTradeRows = useMemo(() => {
    if (!walletKey) return [];
    return [...readLocalTrades(walletKey)].sort((a, b) => b.ts - a.ts).slice(0, 40);
  }, [walletKey, activityEpoch]);
  const localPositionStatsByMint = useMemo(
    () => (walletKey ? buildLocalPositionStatsMap(walletKey) : new Map<string, LocalPositionStat>()),
    [walletKey, activityEpoch],
  );

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
        headers: {
          "Content-Type": "application/json",
          ...(await getWalletAuthHeaders({ wallet: walletKey, signMessage, scope: "write" })),
        },
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
  const { data: goldRushIntelligence, isLoading: goldRushLoading } = useGoldRushWalletIntelligence(walletKey, signMessage);
  const { data: torqueReadiness } = useTorqueRelayReadiness();
  const portfolioActivity = useMemo(() => {
    const localItems = localTradeRows.map(buildLocalActivityItem);
    const walletFlowItems = (goldRushIntelligence?.activity ?? [])
      .filter((item) => item.direction === "in" || item.direction === "out")
      .map(buildWalletFlowActivityItem);
    const combined = [...localItems, ...walletFlowItems].sort((left, right) => right.ts - left.ts);
    const deduped: PortfolioActivityItem[] = [];
    const seen = new Set<string>();
    for (const item of combined) {
      const key = item.id || `${item.kind}-${item.ts}-${item.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 40) break;
    }
    return deduped;
  }, [goldRushIntelligence?.activity, localTradeRows]);

  // ── Positions ─────────────────────────────────────────────────

  const { data: positionsData, isLoading: positionsLoading } = useQuery({
    queryKey: ["dflow-positions", walletKey],
    queryFn: async (): Promise<PositionsQueryData> => {
      if (!publicKey) return { positions: [] };
      const signedUrl = await appendWalletAuthQuery(
        new URL(`${API_URL}/api/dflow/positions?address=${encodeURIComponent(publicKey.toBase58())}`),
        { wallet: publicKey.toBase58(), signMessage, scope: "read" },
      );
      const res = await fetch(signedUrl, { credentials: "omit" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to refresh positions right now.");
      }
      const payload = await res.json().catch(() => ({}));
      return {
        positions: (payload?.data?.positions ?? []) as Position[],
        stale: payload?.data?.stale === true,
        updatedAt: typeof payload?.data?.updatedAt === "string" ? payload.data.updatedAt : undefined,
        degradedReason: typeof payload?.data?.degradedReason === "string" ? payload.data.degradedReason : undefined,
      };
    },
    enabled: !!publicKey,
    staleTime: 12_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  });
  const positions = positionsData?.positions ?? [];
  const positionsAreStale = positionsData?.stale === true;
  const positionsUpdatedAt = positionsData?.updatedAt ?? null;
  const positionsDegradedReason = positionsData?.degradedReason ?? null;

  useEffect(() => {
    if (!publicKey || !walletKey) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let cancelled = false;
    const onMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as {
          success?: boolean;
          data?: { positions?: Position[]; stale?: boolean; updatedAt?: string; degradedReason?: string };
        };
        const list = parsed?.data?.positions;
        if (Array.isArray(list)) {
          queryClient.setQueryData(["dflow-positions", walletKey], {
            positions: list,
            stale: parsed.data?.stale === true,
            updatedAt: parsed.data?.updatedAt,
            degradedReason: parsed.data?.degradedReason,
          } satisfies PositionsQueryData);
        }
      } catch {
        /* ignore malformed SSE payloads */
      }
    };

    void (async () => {
      try {
        const signedUrl = await appendWalletAuthQuery(
          new URL(`${API_URL}/api/dflow/positions/stream?address=${encodeURIComponent(walletKey)}`),
          { wallet: walletKey, signMessage, scope: "read" }
        );
        if (cancelled) return;
        source = new EventSource(signedUrl);
        source.addEventListener("message", onMessage);
      } catch {
        /* ignore stream auth/setup failures */
      }
    })();

    return () => {
      cancelled = true;
      if (source) {
        source.removeEventListener("message", onMessage);
        source.close();
      }
    };
  }, [publicKey, walletKey, queryClient, signMessage]);

  const openPositions = positions.filter((p) => p.status !== "settled");
  const settledPositions = positions.filter((p) => p.status === "settled");
  const activeTab = positionTab === "open" ? openPositions : settledPositions;
  const receiveAssets = useMemo<TransferAssetOption[]>(() => {
    const coreAssets: TransferAssetOption[] = [
      {
        key: "SOL",
        symbol: "SOL",
        name: "Solana",
        kind: "native",
        decimals: 9,
        balance: sol,
        usdValue: solUsd,
        hint: "Native gas and routing asset",
      },
      {
        key: SOLANA_USDC_MINT,
        symbol: "USDC",
        name: "USD Coin",
        mint: SOLANA_USDC_MINT,
        kind: "spl",
        decimals: 6,
        balance: usdc,
        usdValue: usdc,
        hint: "Solana SPL stablecoin",
      },
      {
        key: SOLANA_USDT_MINT,
        symbol: "USDT",
        name: "Tether",
        mint: SOLANA_USDT_MINT,
        kind: "spl",
        decimals: 6,
        balance: usdt,
        usdValue: usdt,
        hint: "Solana SPL stablecoin",
      },
    ];

    const extras = openPositions
      .filter((position) => !!position.mint && (position.balance ?? position.quantity ?? 0) > 0)
      .map((position) => ({
        key: position.mint!,
        symbol: position.outcomeLabel?.trim() || position.side?.toUpperCase() || position.ticker,
        name: position.title || position.ticker,
        mint: position.mint!,
        kind: "spl" as const,
        decimals: position.decimals ?? 6,
        balance: position.balance ?? position.quantity ?? 0,
        usdValue:
          typeof position.marketValueUsd === "number" && Number.isFinite(position.marketValueUsd)
            ? position.marketValueUsd
            : undefined,
        hint: position.ticker,
      }));

    const deduped = new Map<string, TransferAssetOption>();
    for (const asset of [...coreAssets, ...extras]) {
      if (!deduped.has(asset.key)) {
        deduped.set(asset.key, asset);
      }
    }
    return [...deduped.values()];
  }, [openPositions, sol, solUsd, usdc, usdt]);
  const sendAssets = useMemo(
    () => receiveAssets.filter((asset) => asset.balance > 0),
    [receiveAssets],
  );
  const totalPnl = useMemo(
    () =>
      positions.reduce(
        (sum, p) => sum + computePositionPnl(p, p.mint ? (localPositionStatsByMint.get(p.mint) ?? null) : null).usd,
        0,
      ),
    [positions, localPositionStatsByMint, entryEpoch],
  );

  // ── Identity ──────────────────────────────────────────────────

  const { data: proofStatus } = useQuery({
    queryKey: ["dflow-proof-status", walletKey],
    queryFn: async () => {
      if (!publicKey) return { verified: false };
      const signedUrl = await appendWalletAuthQuery(
        new URL(`${API_URL}/api/dflow/proof-status?address=${encodeURIComponent(publicKey.toBase58())}`),
        { wallet: publicKey.toBase58(), signMessage, scope: "read" },
      );
      const res = await fetch(signedUrl, { credentials: "omit" });
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
      showResultModal({ type: "error", title: "Sign up", message: "Sign up first to fund and manage your portfolio." });
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
      showResultModal({ type: "error", title: "Verify", message: "Sign up first to verify your trading identity." });
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

  const loading = balancesLoading;

  if (!connected || !walletKey) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
        <TopBar />
        <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 md:px-6">
          <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <section
              className="rounded-[28px] border p-6 md:p-8"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
            >
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Portfolio Locked
              </p>
              <h1 className="mt-3 font-heading text-[clamp(2rem,5vw,3rem)] font-bold tracking-[-0.03em]" style={{ color: "var(--text-1)", lineHeight: 1.06 }}>
                Sign Up To Track
                <br />
                Your Positions.
              </h1>
              <p className="mt-4 max-w-2xl font-body text-base leading-relaxed" style={{ color: "var(--text-2)" }}>
                Portfolio is where Siren stores your synced positions, execution history, and trade outcomes. Browse the terminal freely first, then sign up when you want those tools unlocked.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/onboarding"
                  onClick={() => hapticLight()}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em]"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Sign Up To Trade
                </Link>
                <Link
                  href="/terminal"
                  onClick={() => hapticLight()}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-base)" }}
                >
                  Browse Terminal
                </Link>
              </div>
            </section>

            <section className="grid gap-4">
              {[
                {
                  title: "Portfolio Sync",
                  body: "Keep your live positions, fills, and execution history in one place instead of guessing what you still hold.",
                },
                {
                  title: "Post-Trade Reports",
                  body: "See what Siren advised, what route failed, and how your latest attempts actually ended.",
                },
                {
                  title: "Wallet Readiness",
                  body: "Unlock GoldRush-backed reserve, concentration, and readiness signals before you take more size.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border p-5"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                >
                  <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                    {item.title}
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </section>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-6 md:pt-8 font-body">

        {/* ── Top row: Balance + Username ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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

        {connected && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Wallet readiness
                  </p>
                  <p className="mt-1 font-sub text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                    Covalent GoldRush is powering the wallet-health read Siren uses before routing size or warning about thin reserves.
                  </p>
                </div>
                <ProviderBadge src={COVALENT_LOGO_URL} alt="Covalent GoldRush" eyebrow="Powered by" status="Covalent GoldRush" />
              </div>
              {goldRushLoading ? (
                <div className="mt-4 flex items-center gap-2" style={{ color: "var(--text-3)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-body text-sm">Reading wallet balances…</span>
                </div>
              ) : goldRushIntelligence ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Visible</p>
                      <p className="mt-2 font-money text-xl font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                        {formatCompactUsd(goldRushIntelligence.summary.totalQuotedUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Risk</p>
                      <p className="mt-2 font-heading text-xl font-semibold" style={{ color: goldRushIntelligence.summary.riskLabel === "high" ? "var(--down)" : "var(--accent)" }}>
                        {goldRushIntelligence.summary.riskScore}/100
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Inbound</p>
                      <p className="mt-2 font-money text-xl font-semibold tabular-nums" style={{ color: "var(--up)" }}>
                        {formatCompactUsd(goldRushIntelligence.summary.inboundUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>Outbound</p>
                      <p className="mt-2 font-money text-xl font-semibold tabular-nums" style={{ color: "var(--down)" }}>
                        {formatCompactUsd(goldRushIntelligence.summary.outboundUsd)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-3">
                      {(goldRushIntelligence.alerts.slice(0, 2) || []).map((alert) => (
                        <div key={alert.label} className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-body text-sm font-medium" style={{ color: "var(--text-1)" }}>{alert.label}</p>
                            <span className="font-heading text-[10px] uppercase tracking-[0.14em]" style={{ color: alert.level === "high" ? "var(--down)" : alert.level === "warn" ? "#fbbf24" : "var(--accent)" }}>
                              {alert.level}
                            </span>
                          </div>
                          <p className="mt-1 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>{alert.summary}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                        What it powers in Siren
                      </p>
                      <ul className="mt-3 space-y-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        <li>Reserve checks before execution starts.</li>
                        <li>Inbound and outbound flow context for wallet readiness.</li>
                        <li>Recent wallet activity that now appears in your activity feed.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                      Siren read
                    </p>
                    <p className="mt-2 font-sub text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {goldRushIntelligence.narrative.readiness}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-4 font-body text-sm" style={{ color: "var(--text-3)" }}>
                  GoldRush wallet intelligence is unavailable right now.
                </p>
              )}
            </div>

            <div className="rounded-[26px] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Reward layer
                  </p>
                  <p className="mt-1 font-sub text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                    Torque is the relay Siren uses to turn execution events into campaigns, nudges, and trader-reward logic.
                  </p>
                </div>
                <ProviderBadge
                  src={TORQUE_LOGO_URL}
                  alt="Torque"
                  eyebrow="Powered by"
                  status={torqueReadiness?.configured ? "Torque relay live" : "Torque pending"}
                />
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    What Torque is doing
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {torqueReadiness?.summary || "Siren is preparing execution events for Torque-based campaigns and relay actions."}
                  </p>
                  {!!torqueReadiness?.eventNames?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {torqueReadiness.eventNames.slice(0, 4).map((eventName) => (
                        <span
                          key={eventName}
                          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}
                        >
                          {eventName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                  <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    What it powers in Siren
                  </p>
                  <ul className="mt-3 space-y-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    <li>Clean-close rewards after successful exits.</li>
                    <li>Resolve-before-expiry nudges when timing risk rises.</li>
                    <li>Execution-quality ranking logic beyond raw trade size.</li>
                  </ul>
                </div>
              </div>
              {(torqueReadiness?.frictionLog?.length || torqueReadiness?.suggestedCampaigns?.length) && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                      Relay watchpoints
                    </p>
                    <ul className="mt-3 space-y-2 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {(torqueReadiness?.frictionLog?.slice(0, 3) || ["No relay friction logged right now."]).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border px-4 py-3" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                    <p className="font-sub text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                      Suggested campaigns
                    </p>
                    <ul className="mt-3 space-y-2 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {(torqueReadiness?.suggestedCampaigns?.slice(0, 3) || []).map((campaign) => (
                        <li key={campaign.name}>
                          <span className="font-heading text-[11px]" style={{ color: "var(--text-1)" }}>{campaign.name}</span>
                          <span>{` · ${campaign.objective}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
              <SwapPanel onActivityLogged={() => setActivityEpoch((n) => n + 1)} />
            </div>
          )}
        </div>

        {/* ── Recent activity ──────────────────────────────── */}
        {connected && walletKey && (
          <div
            className="mt-4 rounded-[26px] border p-5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  Recent activity
                </h2>
                <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Trades, closes, sends, swaps, and wallet inflows or outflows that Siren can currently observe.
                </p>
              </div>
              <ProviderBadge src={COVALENT_LOGO_URL} alt="Covalent GoldRush" eyebrow="Flow tracking" status="On-chain activity live" />
            </div>
            {portfolioActivity.length === 0 ? (
              <p className="mt-6 font-body text-sm text-center py-6" style={{ color: "var(--text-3)" }}>
                Nothing here yet. Make a trade to get started.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {portfolioActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-[22px] border px-4 py-3.5"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium leading-snug" style={{ color: getActivityToneColor(item.tone) }}>
                        {item.title}
                      </p>
                      <p className="mt-1 font-sub text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                        {item.detail}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.amountLabel && (
                        <p className="font-money text-sm font-semibold tabular-nums" style={{ color: getActivityToneColor(item.tone) }}>
                          {item.amountLabel}
                        </p>
                      )}
                      <time
                        className="mt-1 block font-sub text-[11px] tabular-nums"
                        style={{ color: "var(--text-3)" }}
                        dateTime={new Date(item.ts).toISOString()}
                      >
                        {formatActivityTime(item.ts)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Positions ─────────────────────────────────────── */}
        <div className="mt-4 rounded-xl border p-4"
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
            Open positions refresh while this page is open, and rows move into Settled when you close early or when a market ends.
          </p>
          {positionsAreStale && (
            <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ background: "var(--bg-base)", borderColor: "color-mix(in srgb, #fbbf24 26%, var(--border-subtle))" }}>
              <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
                Showing the last good positions snapshot while Solana RPC catches up.
                {positionsUpdatedAt ? ` Last sync: ${new Date(positionsUpdatedAt).toLocaleTimeString()}.` : ""}
              </p>
              {positionsDegradedReason && (
                <p className="mt-1 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                  {positionsDegradedReason}
                </p>
              )}
            </div>
          )}

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
                  localStat={p.mint ? (localPositionStatsByMint.get(p.mint) ?? null) : null}
                  onEntrySaved={() => setEntryEpoch((n) => n + 1)}
                />
              ))
            )}
          </div>
        </div>

        <Link href="/terminal" className="mt-6 inline-flex items-center gap-1.5 font-body text-xs"
          style={{ color: "var(--text-3)" }}>
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
      </main>

      {depositOpen && walletKey && (
        <DepositModal
          walletKey={walletKey}
          assets={receiveAssets}
          onClose={() => setDepositOpen(false)}
          onFund={handleDeposit}
          addressCopied={addressCopied}
          onCopyAddress={copyAddress}
          loading={false}
        />
      )}
      {withdrawOpen && (
        <WithdrawModal assets={sendAssets} solBalance={sol} solPrice={solPrice} onClose={() => setWithdrawOpen(false)} />
      )}
      <Footer />
    </div>
  );
}
