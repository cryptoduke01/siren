"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import Link from "next/link";
import { Wallet, TrendingUp, Coins, Receipt, ArrowUpRight, ExternalLink, Send, ArrowLeftRight, QrCode, Rocket, Loader2, Copy, Check, History } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ResultModal } from "@/components/ResultModal";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";
import bs58 from "bs58";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LAMPORTS_PER_SOL = 1e9;
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

async function fetchSolPrice(): Promise<number> {
  const res = await fetch(`${API_URL}/api/sol-price`, { credentials: "omit" });
  if (!res.ok) return 0;
  const j = await res.json();
  return j.usd ?? 0;
}

async function fetchTokenInfo(mint: string): Promise<{ name: string; symbol: string; imageUrl?: string; priceUsd?: number } | null> {
  const res = await fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(mint)}`, { credentials: "omit" });
  if (!res.ok) return null;
  const j = await res.json();
  const d = j.data;
  if (!d) return null;
  return { name: d.name, symbol: d.symbol, imageUrl: d.imageUrl, priceUsd: d.priceUsd };
}

async function fetchBalances(publicKey: string) {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
  const mainnet = new Connection(rpcUrl, "confirmed");
  const devnet = new Connection(clusterApiUrl("devnet"), "confirmed");
  const pubkey = new PublicKey(publicKey);
  const [mainnetBal, devnetBal] = await Promise.all([
    mainnet.getBalance(pubkey),
    devnet.getBalance(pubkey),
  ]);
  return {
    mainnet: mainnetBal / LAMPORTS_PER_SOL,
    devnet: devnetBal / LAMPORTS_PER_SOL,
  };
}

interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function fetchTokenHoldings(connection: Connection, publicKey: string): Promise<TokenHolding[]> {
  const pubkey = new PublicKey(publicKey);
  const [splAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(pubkey, { programId: new PublicKey(TOKEN_PROGRAM) }),
    connection.getParsedTokenAccountsByOwner(pubkey, { programId: new PublicKey(TOKEN_2022_PROGRAM) }),
  ]);
  const holdings: TokenHolding[] = [];
  const seenMints = new Set<string>();

  for (const { account } of [...splAccounts.value, ...token2022Accounts.value]) {
    const data = account.data as { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount: number; decimals: number }; symbol?: string; name?: string } } };
    const info = data.parsed?.info;
    if (!info?.tokenAmount || info.tokenAmount.uiAmount == null || info.tokenAmount.uiAmount <= 0) continue;
    const mint = info.mint ?? "";
    if (mint === NATIVE_SOL_MINT || seenMints.has(mint)) continue;
    seenMints.add(mint);
    holdings.push({
      mint,
      symbol: info.symbol ?? "—",
      name: info.name ?? "Unknown",
      balance: info.tokenAmount.uiAmount,
      decimals: info.tokenAmount.decimals ?? 6,
    });
  }
  return holdings.sort((a, b) => b.balance - a.balance);
}

interface PredictionPosition {
  mint: string;
  ticker: string;
  title: string;
  side: "yes" | "no";
  balance: number;
  probability?: number;
}

async function fetchMarkets(): Promise<MarketWithVelocity[]> {
  const res = await fetch(`${API_URL}/api/markets`, { credentials: "omit" });
  if (!res.ok) throw new Error("Markets fetch failed");
  const j = await res.json();
  return j.data ?? [];
}

function TransactionHistoryList({ address }: { address: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  useEffect(() => {
    setPage(1);
  }, [address]);
  const { data: txs = [], isLoading, isError } = useQuery({
    queryKey: ["transactions", address],
    queryFn: () =>
      fetch(`${API_URL}/api/transactions?address=${encodeURIComponent(address)}&limit=50`, { credentials: "omit" })
        .then((r) => r.json())
        .then((j) => (j.success && Array.isArray(j.data) ? j.data : [])),
    enabled: !!address && address.length >= 32,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
  if (!address) return null;
  if (isError) {
    return (
      <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
        Unable to load. Add HELIUS_API_KEY to the API.
      </p>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--border-subtle)] animate-pulse" />
        ))}
      </div>
    );
  }
  if (txs.length === 0) {
    return (
      <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
        No recent transactions.
      </p>
    );
  }
  const pageCount = Math.max(1, Math.ceil(txs.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = txs.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
      {pageItems.map((tx: { signature?: string; timestamp?: number; type?: string; description?: string; source?: string }) => {
        const sig = tx.signature ?? "";
        const ts = tx.timestamp ? new Date(tx.timestamp * 1000) : null;
        const type = tx.type ?? tx.source ?? "Transaction";
        const desc = tx.description ?? type;
        return (
          <li
            key={sig}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
          >
            <div className="min-w-0">
              <p className="font-body text-sm truncate" style={{ color: "var(--text-1)" }}>
                {desc}
              </p>
              {ts && (
                <p className="font-body text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            {sig && (
              <a
                href={`https://solscan.io/tx/${sig}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => hapticLight()}
                className="shrink-0 font-body text-[11px] px-2 py-1 rounded"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                View
              </a>
            )}
          </li>
        );
      })}
      </ul>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage === 1}
          className="px-3 py-1.5 rounded-lg border text-[11px] font-body disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}
        >
          Previous
        </button>
        <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
          Page {safePage} / {pageCount}
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={safePage >= pageCount}
          className="px-3 py-1.5 rounded-lg border text-[11px] font-body disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function FeeEarningsSection({
  publicKey,
  signTransaction,
  connection,
  solPriceUsd,
  tokenInfoByMint,
  queryClient,
}: {
  publicKey: { toBase58: () => string } | null;
  signTransaction: ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | undefined;
  connection: Connection;
  solPriceUsd: number;
  tokenInfoByMint: Map<string, { name: string; symbol: string; imageUrl?: string; priceUsd?: number } | null>;
  queryClient: ReturnType<typeof import("@tanstack/react-query").useQueryClient>;
}) {
  const [claimingMint, setClaimingMint] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: ["bags-claimable-positions", publicKey?.toBase58()],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/bags/claimable-positions?wallet=${encodeURIComponent(publicKey!.toBase58())}`, { credentials: "omit" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      return j.data ?? [];
    },
    enabled: !!publicKey,
    staleTime: 30_000,
  });
  const claimable = positions.filter((p: { totalClaimableLamportsUserShare: number }) => (p.totalClaimableLamportsUserShare ?? 0) > 0);
  const handleClaim = async (tokenMint: string) => {
    if (!publicKey || !signTransaction) return;
    hapticLight();
    setClaimingMint(tokenMint);
    setClaimResult(null);
    try {
      const res = await fetch(`${API_URL}/api/bags/claim-txs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeClaimer: publicKey.toBase58(), tokenMint }),
        credentials: "omit",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Claim failed");
      const txs = j.data ?? [];
      if (txs.length === 0) throw new Error("No claim transactions returned");
      for (const item of txs) {
        const txBase58 = item.tx;
        if (!txBase58) continue;
        const buf = bs58.decode(txBase58);
        let tx: Transaction | VersionedTransaction;
        try {
          tx = VersionedTransaction.deserialize(buf);
        } catch {
          tx = Transaction.from(buf);
        }
        const signed = await signTransaction(tx);
        const raw = signed instanceof VersionedTransaction ? signed.serialize() : signed.serialize();
        const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
        await connection.confirmTransaction(sig, "confirmed");
      }
      setClaimResult({ type: "success", message: "Fees claimed!" });
      queryClient.invalidateQueries({ queryKey: ["bags-claimable-positions", publicKey.toBase58()] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance", publicKey.toBase58()] });
      refetch();
    } catch (e) {
      setClaimResult({ type: "error", message: e instanceof Error ? e.message : "Claim failed" });
    } finally {
      setClaimingMint(null);
    }
  };
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-surface)",
        boxShadow: "0 1px 0 0 var(--border-subtle)",
      }}
    >
      <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
          <Receipt className="w-4 h-4" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>Fee earnings</h2>
          <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Bags fee share. Claim SOL from tokens you launched or have fee rights on.
          </p>
        </div>
      </div>
      <div className="p-5">
        {claimResult && (
          <p className={`font-body text-xs mb-3 ${claimResult.type === "success" ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
            {claimResult.message}
          </p>
        )}
        {isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: "var(--text-3)" }} />
          </div>
        ) : claimable.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: "var(--text-3)" }} />
            <p className="font-body text-sm mb-1" style={{ color: "var(--text-2)" }}>No claimable fees</p>
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Launch tokens on Bags or earn fee share to see claimable amounts here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {claimable.map((p: { baseMint: string; totalClaimableLamportsUserShare: number }) => {
              const sol = p.totalClaimableLamportsUserShare / LAMPORTS_PER_SOL;
              const info = tokenInfoByMint.get(p.baseMint);
              const sym = info?.symbol ?? p.baseMint.slice(0, 6);
              const isClaiming = claimingMint === p.baseMint;
              return (
                <li
                  key={p.baseMint}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                >
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-sm truncate" style={{ color: "var(--text-1)" }}>{sym}</p>
                    <p className="font-mono text-xs tabular-nums mt-0.5" style={{ color: "var(--accent)" }}>
                      {sol.toFixed(6)} SOL
                      {solPriceUsd > 0 && (
                        <span className="text-[var(--text-3)] ml-1">(≈${(sol * solPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })})</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaim(p.baseMint)}
                    disabled={isClaiming || !signTransaction}
                    className="font-heading font-semibold text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-50 shrink-0"
                    style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                  >
                    {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Claim"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddressCopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    hapticLight();
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={handleCopy} className="p-1.5 rounded-lg shrink-0 hover:bg-[var(--bg-elevated)] transition-colors" aria-label="Copy address">
      {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />}
    </button>
  );
}

function SendSolModal({
  balanceMainnet,
  balanceDevnet,
  solPriceUsd,
  onClose,
}: {
  balanceMainnet: number;
  balanceDevnet: number;
  solPriceUsd: number;
  onClose: () => void;
}) {
  const { publicKey, signTransaction } = useSirenWallet();
  const [network, setNetwork] = useState<"mainnet" | "devnet">("mainnet");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; title: string; message: string; txSignature?: string } | null>(null);
  const queryClient = useQueryClient();

  const balanceSol = network === "mainnet" ? balanceMainnet : balanceDevnet;
  const conn = new Connection(
    network === "mainnet" ? (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta")) : clusterApiUrl("devnet"),
    "confirmed"
  );
  const amt = parseFloat(amount) || 0;
  const usdEst = network === "mainnet" && amt > 0 ? amt * solPriceUsd : undefined;

  const handleSend = async () => {
    if (!signTransaction || !publicKey) return;
    if (!toAddress.trim() || amt <= 0 || amt > balanceSol) {
      setError("Enter valid address and amount");
      return;
    }
    let to: PublicKey;
    try {
      to = new PublicKey(toAddress.trim());
    } catch {
      setError("Invalid address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const lamports = BigInt(Math.floor(amt * LAMPORTS_PER_SOL));
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(publicKey.toBase58()),
          toPubkey: to,
          lamports,
        })
      );
      const { blockhash } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(publicKey.toBase58());
      const signed = await signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await conn.confirmTransaction(sig, "confirmed");
      setSuccess(`Sent ${amt} SOL on ${network}. Tx: ${sig.slice(0, 8)}...`);
      setAmount("");
      setToAddress("");
      if (publicKey) queryClient.invalidateQueries({ queryKey: ["transactions", publicKey.toBase58()] });
      setResultModal({ type: "success", title: "Send complete", message: `Sent ${amt} SOL on ${network}.`, txSignature: sig });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Send failed";
      setError(errMsg);
      setResultModal({ type: "error", title: "Send failed", message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>Send SOL</p>
          <div className="flex gap-1">
            {(["mainnet", "devnet"] as const).map((n) => (
              <button key={n} type="button" onClick={() => { setNetwork(n); setError(null); }} className="px-2.5 py-1 rounded text-[11px] font-medium" style={{ background: network === n ? "var(--accent-dim)" : "transparent", color: network === n ? "var(--accent)" : "var(--text-3)" }}>{n === "mainnet" ? "Mainnet" : "Devnet"}</button>
            ))}
          </div>
        </div>
        <input type="text" placeholder="Recipient" value={toAddress} onChange={(e) => setToAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg font-mono text-sm mb-2 border" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }} />
        <input type="number" step="0.001" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg font-mono text-sm mb-1 border" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }} />
        <p className={`font-body text-[11px] ${amt > 0 ? "mb-1" : "mb-3"}`} style={{ color: "var(--text-3)" }}>Balance: {balanceSol.toFixed(4)} SOL</p>
        {amt > 0 && (usdEst != null ? <p className="font-body text-[11px] mb-3" style={{ color: "var(--text-2)" }}>≈ ${usdEst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p> : <p className="font-body text-[11px] mb-3" style={{ color: "var(--text-3)" }}>Devnet</p>)}
        {!resultModal && error && <p className="text-xs mb-2" style={{ color: "var(--down)" }}>{error}</p>}
        {!resultModal && success && <p className="text-xs mb-2" style={{ color: "var(--bags)" }}>{success}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleSend} disabled={loading} className="flex-1 py-2 rounded-lg font-heading font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "var(--bags)", color: "var(--accent-text)" }}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Send</button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-body text-sm" style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}>Close</button>
        </div>
        {resultModal && (
          <ResultModal type={resultModal.type} title={resultModal.title} message={resultModal.message} txSignature={resultModal.txSignature} onClose={() => setResultModal(null)} />
        )}
      </div>
    </div>
  );
}

function buildMintToMarket(
  markets: MarketWithVelocity[]
): Map<string, { ticker: string; title: string; side: "yes" | "no"; probability?: number }> {
  const map = new Map<string, { ticker: string; title: string; side: "yes" | "no"; probability?: number }>();
  for (const m of markets) {
    if (m.yes_mint) map.set(m.yes_mint, { ticker: m.ticker, title: m.title, side: "yes", probability: m.probability });
    if (m.no_mint) map.set(m.no_mint, { ticker: m.ticker, title: m.title, side: "no", probability: m.probability });
  }
  return map;
}

export default function PortfolioPage() {
  const { connected, publicKey, signTransaction } = useSirenWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { setSelectedToken, setBuyPanelOpen } = useSirenStore();
  const [balanceView, setBalanceView] = useState<"mainnet" | "devnet">("mainnet");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [bagsLaunches, setBagsLaunches] = useState<string[]>([]);
  const [bagsSyncLoading, setBagsSyncLoading] = useState(false);
  const [walletVolumeSol, setWalletVolumeSol] = useState(0);
  const [platformVolumeSol, setPlatformVolumeSol] = useState(0);
  const [pnlByMint, setPnlByMint] = useState<Record<string, { pnlUsd: number; pnlPercent: number }>>({});

  const loadBagsLaunches = () => {
    if (!publicKey) return;
    try {
      const key = `siren-bags-launches-${publicKey.toBase58()}`;
      const raw = localStorage.getItem(key);
      setBagsLaunches(raw ? JSON.parse(raw) : []);
    } catch {
      setBagsLaunches([]);
    }
  };

  useEffect(() => {
    if (!publicKey) setBagsLaunches([]);
    else loadBagsLaunches();
  }, [publicKey?.toBase58()]);

  const syncBagsLaunches = async () => {
    if (!publicKey) return;
    setBagsSyncLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bags/my-launches?wallet=${encodeURIComponent(publicKey.toBase58())}`, { credentials: "omit" });
      const j = await res.json();
      const mints: string[] = Array.isArray(j.data) ? j.data : [];
      const key = `siren-bags-launches-${publicKey.toBase58()}`;
      const raw = localStorage.getItem(key);
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const merged = [...new Set([...existing, ...mints])];
      localStorage.setItem(key, JSON.stringify(merged));
      setBagsLaunches(merged);
    } catch {
      // ignore
    } finally {
      setBagsSyncLoading(false);
    }
  };

  const { data: balances, isLoading, isError, refetch } = useQuery({
    queryKey: ["wallet-balance", publicKey?.toBase58()],
    queryFn: () => fetchBalances(publicKey!.toBase58()),
    enabled: !!connected && !!publicKey,
    refetchInterval: 30_000,
    retry: 3,
    staleTime: 0,
  });

  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["sol-price"],
    queryFn: fetchSolPrice,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: tokenHoldings = [], isLoading: tokensLoading, refetch: refetchTokens } = useQuery({
    queryKey: ["wallet-tokens", publicKey?.toBase58()],
    queryFn: () => fetchTokenHoldings(connection, publicKey!.toBase58()),
    enabled: !!connected && !!publicKey,
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnMount: "always",
  });

  const tokenMints = tokenHoldings.map((t) => t.mint);
  const { data: tokenInfosList } = useQuery({
    queryKey: ["portfolio-token-infos", tokenMints],
    queryFn: () => Promise.all(tokenMints.map((mint) => fetchTokenInfo(mint))),
    enabled: tokenMints.length > 0,
    staleTime: 60_000,
  });
  const tokenInfoByMint = new Map<string, { name: string; symbol: string; imageUrl?: string; priceUsd?: number } | null>();
  tokenMints.forEach((mint, i) => {
    tokenInfoByMint.set(mint, tokenInfosList?.[i] ?? null);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const cutoffVolume = now - 7 * dayMs;

      // Platform volume (7d, all siren-volume-* keys, device-local)
      let platformVol = 0;
      try {
        const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("siren-volume-"));
        for (const k of keys) {
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;
          const entries: Array<{ ts?: number; volumeSol?: number }> = JSON.parse(raw);
          if (!Array.isArray(entries)) continue;
          platformVol += entries
            .filter((e) => (e.ts ?? 0) >= cutoffVolume && typeof e.volumeSol === "number" && Number.isFinite(e.volumeSol))
            .reduce((sum, e) => sum + (e.volumeSol || 0), 0);
        }
      } catch {
        platformVol = 0;
      }
      setPlatformVolumeSol(platformVol);

      if (!publicKey) {
        setWalletVolumeSol(0);
        setPnlByMint({});
        return;
      }

      // Wallet volume (7d)
      const volKey = `siren-volume-${publicKey.toBase58()}`;
      const rawVol = window.localStorage.getItem(volKey);
      let totalVol = 0;
      if (rawVol) {
        try {
          const entries: Array<{ ts?: number; volumeSol?: number }> = JSON.parse(rawVol);
          if (Array.isArray(entries)) {
            totalVol = entries
              .filter((e) => (e.ts ?? 0) >= cutoffVolume && typeof e.volumeSol === "number" && Number.isFinite(e.volumeSol))
              .reduce((sum, e) => sum + (e.volumeSol || 0), 0);
          }
        } catch {
          totalVol = 0;
        }
      }
      setWalletVolumeSol(totalVol);

      // PnL (approximate, cost basis from buys/sells)
      const tradesKey = `siren-trades-${publicKey.toBase58()}`;
      const rawTrades = window.localStorage.getItem(tradesKey);
      const nextPnl: Record<string, { pnlUsd: number; pnlPercent: number }> = {};
      if (rawTrades && tokenInfosList && tokenMints.length > 0) {
        try {
          const trades: Array<{
            ts?: number;
            mint?: string;
            side?: "buy" | "sell";
            tokenAmount?: number;
            priceUsd?: number;
          }> = JSON.parse(rawTrades);
          if (Array.isArray(trades)) {
            const sorted = [...trades].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
            const agg = new Map<string, { tokens: number; costUsd: number }>();
            for (const t of sorted) {
              if (!t?.mint || typeof t.tokenAmount !== "number" || typeof t.priceUsd !== "number") continue;
              if (!Number.isFinite(t.tokenAmount) || t.tokenAmount <= 0 || !Number.isFinite(t.priceUsd) || t.priceUsd <= 0)
                continue;
              const cur = agg.get(t.mint) || { tokens: 0, costUsd: 0 };
              if (t.side === "buy") {
                cur.tokens += t.tokenAmount;
                cur.costUsd += t.tokenAmount * t.priceUsd;
              } else if (t.side === "sell") {
                const sell = Math.min(t.tokenAmount, cur.tokens);
                if (sell > 0 && cur.tokens > 0) {
                  cur.costUsd *= 1 - sell / cur.tokens;
                  cur.tokens -= sell;
                }
              }
              agg.set(t.mint, cur);
            }
            for (const mint of tokenMints) {
              const holding = tokenHoldings.find((h) => h.mint === mint);
              const info = tokenInfoByMint.get(mint);
              const priceUsd = info?.priceUsd;
              const lot = agg.get(mint);
              if (!holding || !priceUsd || !lot || lot.tokens <= 0) continue;
              const balance = holding.balance;
              const costBasis = (lot.costUsd / lot.tokens) * Math.min(balance, lot.tokens);
              const pnlUsd = balance * priceUsd - costBasis;
              const pnlPercent = costBasis > 0 ? ((balance * priceUsd) / costBasis - 1) * 100 : 0;
              if (!Number.isFinite(pnlUsd) || !Number.isFinite(pnlPercent)) continue;
              nextPnl[mint] = { pnlUsd, pnlPercent };
            }
          }
        } catch {
          // ignore
        }
      }
      setPnlByMint(nextPnl);
    } catch {
      setWalletVolumeSol(0);
      setPlatformVolumeSol(0);
      setPnlByMint({});
    }
  }, [publicKey?.toBase58(), solPriceUsd, tokenInfosList, tokenMints.join(","), tokenHoldings.length]);

  const { data: bagsLaunchInfos } = useQuery({
    queryKey: ["bags-launch-infos", bagsLaunches],
    queryFn: () => Promise.all(bagsLaunches.map((mint) => fetchTokenInfo(mint))),
    enabled: bagsLaunches.length > 0,
    staleTime: 60_000,
  });
  const bagsLaunchInfoByMint = new Map<string, { name: string; symbol: string; imageUrl?: string; priceUsd?: number } | null>();
  bagsLaunches.forEach((mint, i) => {
    bagsLaunchInfoByMint.set(mint, bagsLaunchInfos?.[i] ?? null);
  });

  async function fetchClaimStats(mint: string) {
    const res = await fetch(`${API_URL}/api/bags/claim-stats?tokenMint=${encodeURIComponent(mint)}`, { credentials: "omit" });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j.data) ? j.data : [];
  }
  const { data: claimStatsByMint } = useQuery({
    queryKey: ["bags-claim-stats", publicKey?.toBase58(), bagsLaunches],
    queryFn: () => Promise.all(bagsLaunches.map((mint) => fetchClaimStats(mint))),
    enabled: !!publicKey && bagsLaunches.length > 0,
    staleTime: 60_000,
  });
  const myClaimedByMint = new Map<string, string>();
  if (publicKey && claimStatsByMint) {
    const wallet = publicKey.toBase58();
    claimStatsByMint.forEach((stats, i) => {
      const mint = bagsLaunches[i];
      const me = stats.find((s: { wallet: string }) => s.wallet === wallet);
      if (me && typeof (me as { totalClaimed?: string }).totalClaimed === "string") {
        myClaimedByMint.set(mint, (me as { totalClaimed: string }).totalClaimed);
      }
    });
  }

  const totalUsd =
    (balances?.mainnet ?? 0) * solPriceUsd +
    tokenHoldings.reduce(
      (sum, t) => sum + t.balance * (tokenInfoByMint.get(t.mint)?.priceUsd ?? 0),
      0
    );

  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: !!connected,
    staleTime: 60_000,
  });

  const mintToMarket = buildMintToMarket(markets);
  const predictionPositions: PredictionPosition[] = tokenHoldings
    .filter((t) => mintToMarket.has(t.mint))
    .map((t) => {
      const info = mintToMarket.get(t.mint)!;
      return {
        mint: t.mint,
        ticker: info.ticker,
        title: info.title,
        side: info.side,
        balance: t.balance,
        probability: info.probability,
      };
    });

  const openSellPanel = (mint: string, symbol: string, name: string) => {
    setSelectedToken({ mint, symbol, name }, { openForSell: true });
    setBuyPanelOpen(true);
  };

  const predictionMints = new Set(predictionPositions.map((p) => p.mint));
  const pnlPositions = [
    ...predictionPositions.map((p) => {
      const info = tokenInfoByMint.get(p.mint);
      const priceUsd = info?.priceUsd ?? 0;
      const valueUsd = p.balance * priceUsd;
      const mintPnl = pnlByMint[p.mint];
      return {
        ticker: p.ticker,
        title: p.title,
        side: p.side as "yes" | "no",
        kalshiMarket: `Kalshi: ${p.ticker}`,
        valueUsd,
        pnlUsd: mintPnl ? mintPnl.pnlUsd : null,
        pnlPercent: mintPnl ? mintPnl.pnlPercent : null,
        mint: p.mint,
      };
    }),
    ...tokenHoldings
      .filter((t) => !predictionMints.has(t.mint))
      .map((t) => {
        const info = tokenInfoByMint.get(t.mint);
        const valueUsd = (info?.priceUsd ?? 0) * t.balance;
        const mintPnl = pnlByMint[t.mint];
        return {
          ticker: info?.symbol ?? t.symbol,
          title: info?.name ?? t.name,
          valueUsd,
          pnlUsd: mintPnl ? mintPnl.pnlUsd : null,
          pnlPercent: mintPnl ? mintPnl.pnlPercent : null,
          mint: t.mint,
        };
      }),
  ].filter((p) => p.valueUsd > 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
        <div className="mb-8">
          <h1 className="font-heading font-bold text-2xl md:text-3xl mb-1" style={{ color: "var(--accent)" }}>
            Portfolio
          </h1>
          <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
            PnL, balances, prediction positions, token holdings & fee earnings in one place.
          </p>
        </div>
        {!connected ? (
          <div
            className="rounded-2xl border p-10 md:p-14 text-center max-w-md mx-auto"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-surface)",
              boxShadow: "0 1px 0 0 var(--border-subtle)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            >
              <Wallet className="w-8 h-8" style={{ color: "var(--text-3)" }} />
            </div>
            <p className="font-heading font-semibold text-lg mb-2" style={{ color: "var(--text-1)" }}>
              Connect your wallet
            </p>
            <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
              Connect Phantom, Solflare, or another supported wallet to view balances, positions, and token holdings.
            </p>
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Use the wallet button in the top bar to connect.
            </p>
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl border p-6 md:p-8 mb-6"
              style={{
                borderColor: "var(--border-subtle)",
                background: "linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
                boxShadow: "0 1px 0 0 var(--border-subtle), 0 4px 24px rgba(0,0,0,0.06)",
              }}
            >
              <p className="font-body text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>
                Total portfolio value
              </p>
              {isLoading ? (
                <div className="h-10 w-32 rounded bg-[var(--border-subtle)] animate-pulse" />
              ) : solPriceUsd > 0 ? (
                <p className="font-heading font-bold text-3xl md:text-4xl tabular-nums" style={{ color: "var(--accent)" }}>
                  ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="font-heading font-bold text-2xl md:text-3xl tabular-nums" style={{ color: "var(--text-2)" }}>
                  <span className="font-mono">{(balances?.mainnet ?? 0).toFixed(4)} SOL</span>
                  <span className="font-body text-base ml-2 font-normal" style={{ color: "var(--text-3)" }}>+ tokens (USD loading…)</span>
                </p>
              )}
              <p className="font-body text-xs mt-1" style={{ color: "var(--text-3)" }}>
                Mainnet SOL + token holdings (USD)
              </p>
              {walletVolumeSol > 0 && (
                <p className="font-body text-xs mt-2" style={{ color: "var(--text-2)" }}>
                  Your 7d volume:{" "}
                  <span className="font-mono">
                    {walletVolumeSol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                  </span>
                  {solPriceUsd > 0 && (
                    <>
                      {" "}
                      (≈$
                      {(walletVolumeSol * solPriceUsd).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                      )
                    </>
                  )}
                </p>
              )}
              {platformVolumeSol > 0 && (
                <p className="font-body text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  Platform 7d volume:{" "}
                  <span className="font-mono">
                    {platformVolumeSol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                  </span>
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { hapticLight(); setReceiveOpen(true); }}
                  className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Receive
                </button>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setSwapOpen(true); }}
                  className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setSendOpen(true); }}
                  className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
              {swapOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }} onClick={() => { hapticLight(); setSwapOpen(false); }}>
                  <div className="w-full max-w-md rounded-2xl border overflow-hidden shadow-2xl" style={{ background: "linear-gradient(165deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)", borderColor: "var(--border-subtle)", boxShadow: "0 0 0 1px var(--border-subtle), 0 24px 48px -12px rgba(0,0,0,0.4)" }} onClick={(e) => e.stopPropagation()}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <h3 className="font-heading font-semibold text-base" style={{ color: "var(--text-1)" }}>Sell token</h3>
                      <p className="font-body text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>Select a token to sell</p>
                    </div>
                    <div className="p-4">
                      {tokenHoldings.length === 0 ? (
                        <p className="font-body text-sm py-6 text-center" style={{ color: "var(--text-3)" }}>No tokens. Buy from Terminal first.</p>
                      ) : (
                        <ul className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
                          {tokenHoldings.map((t) => {
                            const info = tokenInfoByMint.get(t.mint);
                            const sym = info?.symbol ?? (t.symbol !== "—" ? t.symbol : t.mint.slice(0, 6));
                            const name = info?.name ?? t.name;
                            return (
                              <li key={t.mint} className="flex items-center gap-3 rounded-xl border p-3 min-w-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                                <div className="min-w-0 flex-1">
                                  <p className="font-heading font-semibold text-sm truncate" style={{ color: "var(--text-1)" }}>{sym}</p>
                                  <p className="font-mono text-xs tabular-nums truncate" style={{ color: "var(--text-3)" }}>{t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { hapticLight(); setSelectedToken({ mint: t.mint, name, symbol: sym }, { openForSell: true }); setBuyPanelOpen(true, "token"); setSwapOpen(false); }}
                                  className="shrink-0 px-4 py-2 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide transition-all hover:brightness-110"
                                  style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                                >
                                  Sell
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <button type="button" onClick={() => { hapticLight(); setSwapOpen(false); }} className="w-full py-2.5 rounded-xl font-body text-sm" style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {sendOpen && (
                <SendSolModal
                  balanceMainnet={balances?.mainnet ?? 0}
                  balanceDevnet={balances?.devnet ?? 0}
                  solPriceUsd={solPriceUsd}
                  onClose={() => { hapticLight(); setSendOpen(false); }}
                />
              )}
              {receiveOpen && publicKey && (
                <div
                  className="fixed inset-0 z-40 flex items-center justify-center px-4"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                  onClick={() => { hapticLight(); setReceiveOpen(false); }}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl border p-5"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="font-heading text-sm mb-1" style={{ color: "var(--text-1)" }}>
                      Receive SOL & tokens
                    </p>
                    <p className="font-body text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
                      Scan this code or share your address to receive funds.
                    </p>
                    <div className="flex justify-center mb-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(publicKey.toBase58())}`}
                        alt="Wallet QR code"
                        className="rounded-lg border"
                        style={{ borderColor: "var(--border-subtle)" }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="font-mono text-xs truncate flex-1" style={{ color: "var(--text-2)" }}>
                        {publicKey.toBase58()}
                      </code>
                      <button
                        type="button"
                        onClick={() => { hapticLight(); navigator.clipboard.writeText(publicKey.toBase58()); }}
                        className="font-body text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
                        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { hapticLight(); setReceiveOpen(false); }}
                      className="mt-1 w-full font-body text-xs py-2 rounded-xl"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 min-w-0">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 1px 0 0 var(--border-subtle)",
              }}
            >
              <div
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-dim)" }}>
                    <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                      Wallet balance
                    </h2>
                    <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                      Native SOL
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { hapticLight(); setBalanceView("mainnet"); }}
                    className="font-body text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: balanceView === "mainnet" ? "var(--accent-dim)" : "transparent",
                      color: balanceView === "mainnet" ? "var(--accent)" : "var(--text-3)",
                      border: balanceView === "mainnet" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    Mainnet
                  </button>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); setBalanceView("devnet"); }}
                    className="font-body text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: balanceView === "devnet" ? "var(--accent-dim)" : "transparent",
                      color: balanceView === "devnet" ? "var(--accent)" : "var(--text-3)",
                      border: balanceView === "devnet" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    Devnet
                  </button>
                </div>
              </div>
              {publicKey && (
                <div className="px-5 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <code className="font-mono text-[11px] truncate flex-1" style={{ color: "var(--text-2)" }}>
                    {publicKey.toBase58()}
                  </code>
                  <AddressCopyButton address={publicKey.toBase58()} />
                </div>
              )}
              <div className="p-5 grid grid-cols-2 gap-4">
                {isLoading ? (
                  <div className="col-span-2 font-body text-sm py-4" style={{ color: "var(--text-2)" }}>
                    Loading…
                  </div>
                ) : isError ? (
                  <div className="col-span-2 space-y-3 py-4">
                    <p className="font-body text-sm" style={{ color: "var(--down)" }}>
                      Failed to fetch balance.
                    </p>
                    <button
                      onClick={() => refetch()}
                      className="font-body text-sm px-4 py-2 rounded-xl transition-colors hover:opacity-90"
                      style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                    >
                      Retry
                    </button>
                  </div>
                ) : balances ? (
                  <>
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: balanceView === "mainnet" ? "var(--border-active)" : "var(--border-subtle)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <p className="font-body text-[11px] mb-1" style={{ color: "var(--text-3)" }}>Mainnet</p>
                      <p className="font-mono text-lg tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
                        {balances.mainnet.toFixed(4)} SOL
                      </p>
                      <p className="font-mono text-xs mt-1 tabular-nums" style={{ color: "var(--text-2)" }}>
                        {solPriceUsd > 0
                          ? `≈ $${(balances.mainnet * solPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : "— USD"}
                      </p>
                    </div>
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: balanceView === "devnet" ? "var(--border-active)" : "var(--border-subtle)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <p className="font-body text-[11px] mb-1" style={{ color: "var(--text-3)" }}>Devnet</p>
                      <p className="font-mono text-lg tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
                        {balances.devnet.toFixed(4)} SOL
                      </p>
                      <p className="font-mono text-xs mt-1 tabular-nums" style={{ color: "var(--text-2)" }}>
                        {solPriceUsd > 0
                          ? `≈ $${(balances.devnet * solPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : "— USD"}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 1px 0 0 var(--border-subtle)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center gap-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(139, 92, 246, 0.12)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "var(--kalshi)" }} />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                    Prediction positions
                  </h2>
                  <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    YES/NO shares from Kalshi (DFlow)
                  </p>
                </div>
              </div>
              <div className="p-5">
                {predictionPositions.length === 0 ? (
                  <div className="py-8 text-center">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--text-3)" }} />
                    <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
                      No prediction positions yet
                    </p>
                    <p className="font-body text-xs mb-4" style={{ color: "var(--text-3)" }}>
                      Buy YES/NO shares from the Terminal to add positions here.
                    </p>
                    <Link
                      href="/"
                      onClick={() => hapticLight()}
                      className="inline-flex items-center gap-2 font-body text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:opacity-90"
                      style={{ background: "var(--kalshi)", color: "white" }}
                    >
                      Go to Terminal
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {predictionPositions.map((p) => (
                      <li
                        key={`${p.ticker}-${p.side}`}
                        className="rounded-xl border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          background: "var(--bg-elevated)",
                        }}
                      >
                        <p className="font-heading font-medium text-sm line-clamp-2 mb-3" style={{ color: "var(--text-1)" }}>
                          {p.title}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className="text-[11px] font-body font-semibold px-2.5 py-1 rounded-lg"
                            style={{
                              background: p.side === "yes" ? "var(--bags-dim)" : "var(--down-dim)",
                              color: p.side === "yes" ? "var(--bags)" : "var(--down)",
                            }}
                          >
                            {p.side.toUpperCase()}
                          </span>
                          <div className="text-right">
                            <p className="font-mono text-sm tabular-nums font-medium" style={{ color: "var(--kalshi)" }}>
                              {p.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </p>
                            {p.probability != null && (
                              <p className="font-mono text-[11px] tabular-nums mt-0.5" style={{ color: "var(--text-3)" }}>
                                Market {p.probability.toFixed(0)}% YES
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 1px 0 0 var(--border-subtle)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between gap-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--bags-dim)" }}>
                    <Coins className="w-4 h-4" style={{ color: "var(--bags)" }} />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                      Token holdings
                    </h2>
                    <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                      SPL & Token-2022 (Pump, Jupiter, etc.)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { hapticLight(); refetchTokens(); }}
                  disabled={tokensLoading}
                  className="shrink-0 font-body text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}
                >
                  {tokensLoading ? "…" : "Refresh"}
                </button>
              </div>
              <div className="p-5">
                {tokensLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-[var(--border-subtle)] animate-pulse" />
                    ))}
                  </div>
                ) : tokenHoldings.length === 0 ? (
                  <div className="py-8 text-center">
                    <Coins className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--text-3)" }} />
                    <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
                      No tokens yet
                    </p>
                    <p className="font-body text-xs mb-4" style={{ color: "var(--text-3)" }}>
                      Buy from the Terminal or Trending to see holdings here.
                    </p>
                    <Link
                      href="/"
                      onClick={() => hapticLight()}
                      className="inline-flex items-center gap-2 font-body text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:opacity-90"
                      style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                    >
                      Browse tokens
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {tokenHoldings.map((t) => {
                      const info = tokenInfoByMint.get(t.mint);
                      const displayName = info?.name ?? t.name;
                      const displaySymbol = info?.symbol ?? (t.symbol !== "—" ? t.symbol : t.mint.slice(0, 8) + "…");
                      const valueUsd = info?.priceUsd != null ? t.balance * info.priceUsd : undefined;
                      const mintPnl = pnlByMint[t.mint];
                      return (
                        <li
                          key={t.mint}
                          className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
                          style={{
                            borderColor: "var(--border-subtle)",
                            background: "var(--bg-elevated)",
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => { hapticLight(); openSellPanel(t.mint, t.symbol, t.name); }}>
                            {info?.imageUrl ? (
                              <img src={info.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                            ) : (
                              <div
                                className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-mono text-sm font-semibold"
                                style={{ background: "var(--border-subtle)", color: "var(--text-3)" }}
                              >
                                {displaySymbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-heading font-semibold truncate" style={{ color: "var(--text-1)" }}>
                                {displaySymbol}
                              </p>
                              <p className="font-body text-xs truncate" style={{ color: "var(--text-3)" }}>
                                {displayName !== "Unknown" ? displayName : t.mint}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <div>
                              <p className="font-mono text-sm tabular-nums font-medium" style={{ color: "var(--bags)" }}>
                                {t.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                              </p>
                              {valueUsd != null && (
                                <p className="font-mono text-xs tabular-nums mt-0.5" style={{ color: "var(--text-2)" }}>
                                  ≈ ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                </p>
                              )}
                              <p className="font-mono text-[11px] mt-1" style={{ color: mintPnl ? (mintPnl.pnlUsd >= 0 ? "var(--up)" : "var(--down)") : "var(--text-3)" }} title="Approximate PnL from Siren trades">
                                PnL:{" "}
                                {mintPnl
                                  ? `${mintPnl.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(mintPnl.pnlUsd).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} (${mintPnl.pnlPercent.toFixed(1)}%)`
                                  : "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); hapticLight(); openSellPanel(t.mint, t.symbol, t.name); }}
                              className="px-4 py-2 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide transition-all hover:brightness-110 shrink-0"
                              style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                            >
                              Sell
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <FeeEarningsSection
              publicKey={publicKey}
              signTransaction={signTransaction}
              connection={connection}
              solPriceUsd={solPriceUsd}
              tokenInfoByMint={tokenInfoByMint}
              queryClient={queryClient}
            />
          </div>

          {/* Transaction history */}
          <div
            className="mt-6 rounded-2xl border overflow-hidden"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-surface)",
              boxShadow: "0 1px 0 0 var(--border-subtle)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center gap-3 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-dim)" }}>
                <History className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                  Transaction history
                </h2>
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  For {publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "your wallet"} — Helius
                </p>
              </div>
            </div>
            <div className="p-5">
              <TransactionHistoryList address={publicKey?.toBase58() ?? ""} key={publicKey?.toBase58() ?? "none"} />
            </div>
          </div>

          {/* Your Bags launches */}
          <div
            className="mt-6 rounded-2xl border overflow-hidden"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-surface)",
              boxShadow: "0 1px 0 0 var(--border-subtle)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center gap-3 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-dim)" }}>
                <Rocket className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                  Your Bags launches
                </h2>
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  Tokens you launched via Bags and any fee share claimed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { hapticLight(); syncBagsLaunches(); }}
                disabled={bagsSyncLoading}
                className="shrink-0 font-body text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}
              >
                {bagsSyncLoading ? "Syncing…" : "Sync"}
              </button>
            </div>
            <div className="p-5">
              {bagsLaunches.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
                    You haven&apos;t launched any tokens with Bags yet.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => { hapticLight(); syncBagsLaunches(); }}
                      disabled={bagsSyncLoading}
                      className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2 rounded-xl transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--border-subtle)" }}
                    >
                      {bagsSyncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Sync from Bags
                    </button>
                    <Link
                      href="/"
                      onClick={() => hapticLight()}
                      className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2 rounded-xl transition-colors hover:opacity-90"
                      style={{ background: "var(--bags)", color: "var(--accent-text)" }}
                    >
                      Go to terminal
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {bagsLaunches.map((mint) => {
                    const info = bagsLaunchInfoByMint.get(mint);
                    const claimedRaw = myClaimedByMint.get(mint);
                    const claimedLamports = claimedRaw ? Number(claimedRaw) : 0;
                    const claimedSol = claimedLamports / LAMPORTS_PER_SOL;
                    const claimedUsd = claimedSol * solPriceUsd;
                    return (
                      <li
                        key={mint}
                        className="flex items-center justify-between gap-4 rounded-xl border p-4"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {info?.imageUrl ? (
                            <img src={info.imageUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-mono text-xs font-semibold"
                              style={{ background: "var(--border-subtle)", color: "var(--text-3)" }}
                            >
                              {(info?.symbol ?? mint).slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-heading font-semibold truncate" style={{ color: "var(--text-1)" }}>
                              {info?.symbol ?? mint.slice(0, 4)}
                            </p>
                            <p className="font-body text-xs truncate" style={{ color: "var(--text-3)" }}>
                              Launched on Bags
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {claimedLamports > 0 ? (
                            <>
                              <p className="font-body text-[10px] uppercase mb-1" style={{ color: "var(--text-3)" }}>
                                Fees claimed
                              </p>
                              <p className="font-mono text-xs tabular-nums" style={{ color: "var(--bags)" }}>
                                {claimedSol.toFixed(4)} SOL
                              </p>
                              <p className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-2)" }}>
                                ≈ ${claimedUsd.toFixed(2)} USD
                              </p>
                            </>
                          ) : (
                            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                              No fees claimed yet.
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
        )}
      </main>
    </div>
  );
}
