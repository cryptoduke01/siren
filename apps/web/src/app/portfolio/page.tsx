"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import Link from "next/link";
import { Wallet, TrendingUp, Coins, Receipt, ArrowUpRight, ExternalLink, Send, ArrowLeftRight, QrCode, Rocket } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

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

async function fetchTokenHoldings(connection: Connection, publicKey: string): Promise<TokenHolding[]> {
  const pubkey = new PublicKey(publicKey);
  const accounts = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
  const holdings: TokenHolding[] = [];
  for (const { account } of accounts.value) {
    const data = account.data as { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount: number; decimals: number }; symbol?: string; name?: string } } };
    const info = data.parsed?.info;
    if (!info?.tokenAmount || info.tokenAmount.uiAmount == null || info.tokenAmount.uiAmount <= 0) continue;
    const mint = info.mint ?? "";
    if (mint === NATIVE_SOL_MINT) continue;
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
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { setSelectedToken, setBuyPanelOpen } = useSirenStore();
  const [balanceView, setBalanceView] = useState<"mainnet" | "devnet">("mainnet");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [bagsLaunches, setBagsLaunches] = useState<string[]>([]);

  useEffect(() => {
    if (!publicKey) {
      setBagsLaunches([]);
      return;
    }
    try {
      const key = `siren-bags-launches-${publicKey.toBase58()}`;
      const raw = localStorage.getItem(key);
      setBagsLaunches(raw ? JSON.parse(raw) : []);
    } catch {
      setBagsLaunches([]);
    }
  }, [publicKey]);

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

  const { data: tokenHoldings = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["wallet-tokens", publicKey?.toBase58()],
    queryFn: () => fetchTokenHoldings(connection, publicKey!.toBase58()),
    enabled: !!connected && !!publicKey,
    refetchInterval: 30_000,
    staleTime: 20_000,
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
        <div className="mb-8">
          <h1 className="font-heading font-bold text-2xl md:text-3xl mb-1" style={{ color: "var(--text-1)" }}>
            Portfolio
          </h1>
          <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
            Balances, prediction positions, token holdings & fee earnings in one place.
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
              ) : (
                <p className="font-heading font-bold text-3xl md:text-4xl tabular-nums" style={{ color: "var(--accent)" }}>
                  ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <p className="font-body text-xs mt-1" style={{ color: "var(--text-3)" }}>
                Mainnet SOL + token holdings (USD)
              </p>
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
                <a
                  href={publicKey ? `https://jup.ag/swap/SOL?wallet=${publicKey.toBase58()}` : "https://jup.ag/swap"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => hapticLight()}
                  className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Swap
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => hapticLight()}
                  className="inline-flex items-center gap-2 font-body text-xs font-medium px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
                  <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                    Wallet balance
                  </h2>
                  <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    Native SOL — toggle network below
                  </p>
                </div>
              </div>
              <div className="px-5 pb-2 flex gap-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setBalanceView("mainnet"); }}
                  className="font-body text-[11px] font-medium px-3 py-2 rounded-lg transition-colors"
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
                  className="font-body text-[11px] font-medium px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: balanceView === "devnet" ? "var(--accent-dim)" : "transparent",
                    color: balanceView === "devnet" ? "var(--accent)" : "var(--text-3)",
                    border: balanceView === "devnet" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                  }}
                >
                  Devnet
                </button>
              </div>
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
                        ≈ ${(balances.mainnet * solPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
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
                        ≈ ${(balances.devnet * solPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
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
                className="px-5 py-4 flex items-center gap-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bags-dim)" }}>
                  <Coins className="w-4 h-4" style={{ color: "var(--bags)" }} />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                    Token holdings
                  </h2>
                  <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    SPL tokens (Jupiter / DexScreener)
                  </p>
                </div>
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
                      return (
                        <li
                          key={t.mint}
                          className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)] cursor-pointer"
                          style={{
                            borderColor: "var(--border-subtle)",
                            background: "var(--bg-elevated)",
                          }}
                          onClick={() => openSellPanel(t.mint, t.symbol, t.name)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
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
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm tabular-nums font-medium" style={{ color: "var(--bags)" }}>
                              {t.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </p>
                            {valueUsd != null && (
                              <p className="font-mono text-xs tabular-nums mt-0.5" style={{ color: "var(--text-2)" }}>
                                ≈ ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                              </p>
                            )}
                            <p className="font-body text-[11px] mt-1 font-medium" style={{ color: "var(--accent)" }}>
                              Sell
                            </p>
                          </div>
                        </li>
                      );
                    })}
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
                className="px-5 py-4 flex items-center gap-3 border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
                  <Receipt className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                    Fee earnings
                  </h2>
                  <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                    Fees from Kalshi referrals, partner programs, and Bags fee share will appear here.
                  </p>
                </div>
              </div>
              <div className="p-5">
                <div
                  className="rounded-xl border border-dashed p-6 text-center"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                >
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: "var(--text-3)" }} />
                  <p className="font-body text-sm mb-1" style={{ color: "var(--text-2)" }}>
                    No fees earned yet
                  </p>
                  <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                    Fees from Kalshi referrals, partner programs, and Bags fee share will appear here.
                  </p>
                </div>
              </div>
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
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
                <Rocket className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                  Your Bags launches
                </h2>
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  Tokens you launched via Bags and any fee share claimed.
                </p>
              </div>
            </div>
            <div className="p-5">
              {bagsLaunches.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-body text-sm mb-2" style={{ color: "var(--text-2)" }}>
                    You haven&apos;t launched any tokens with Bags yet.
                  </p>
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
