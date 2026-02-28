"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import { TopBar } from "@/components/TopBar";
import { useSirenStore } from "@/store/useSirenStore";
import type { MarketWithVelocity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LAMPORTS_PER_SOL = 1e9;
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

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

  const { data: balances, isLoading, isError, refetch } = useQuery({
    queryKey: ["wallet-balance", publicKey?.toBase58()],
    queryFn: () => fetchBalances(publicKey!.toBase58()),
    enabled: !!connected && !!publicKey,
    refetchInterval: 30_000,
    retry: 3,
    staleTime: 0,
  });

  const { data: tokenHoldings = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["wallet-tokens", publicKey?.toBase58()],
    queryFn: () => fetchTokenHoldings(connection, publicKey!.toBase58()),
    enabled: !!connected && !!publicKey,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

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
    <div className="min-h-screen flex flex-col bg-siren-bg">
      <TopBar />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-siren-primary mb-2">Portfolio</h1>
        <p className="text-siren-text-secondary text-sm mb-6">
          Kalshi positions (DFlow) + token holdings (Jupiter). Fee earnings.
        </p>
        {!connected ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-12 text-center">
            <p className="text-siren-text-secondary mb-4">Connect your wallet to view positions and balances.</p>
            <p className="text-siren-text-secondary text-sm">
              Connect Phantom, Solflare, or another supported wallet to see mainnet and devnet balances.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="font-heading font-semibold text-siren-primary text-sm uppercase tracking-wider">Wallet Balance</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                {isLoading ? (
                  <div className="col-span-2 text-siren-text-secondary text-sm">Loading…</div>
                ) : isError ? (
                  <div className="col-span-2 space-y-2">
                    <p className="text-red-400 text-sm">Failed to fetch balance.</p>
                    <button
                      onClick={() => refetch()}
                      className="text-siren-primary text-sm hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : balances ? (
                  <>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-siren-text-secondary text-xs mb-1">Mainnet</p>
                      <p className="font-data text-siren-text-primary text-xl tabular-nums">{balances.mainnet.toFixed(4)}</p>
                      <p className="text-siren-text-secondary text-xs">SOL</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-siren-text-secondary text-xs mb-1">Devnet</p>
                      <p className="font-data text-siren-text-primary text-xl tabular-nums">{balances.devnet.toFixed(4)}</p>
                      <p className="text-siren-text-secondary text-xs">SOL</p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="font-heading font-semibold text-siren-kalshi text-sm uppercase tracking-wider">Prediction market positions</h2>
              </div>
              <div className="p-6">
                {predictionPositions.length === 0 ? (
                  <p className="text-siren-text-secondary text-sm">No prediction market positions. Buy YES/NO from the terminal.</p>
                ) : (
                  <ul className="space-y-3">
                    {predictionPositions.map((p) => (
                      <li
                        key={`${p.ticker}-${p.side}`}
                        className="rounded-xl border border-white/10 bg-black/20 p-4 hover:border-siren-kalshi/40 transition-colors"
                      >
                        <p className="font-heading font-medium text-siren-text-primary text-sm line-clamp-1">{p.title}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.side === "yes" ? "bg-siren-kalshi/20 text-siren-kalshi" : "bg-red-500/20 text-red-400"}`}>
                            {p.side.toUpperCase()}
                          </span>
                          <span className="font-data text-siren-kalshi tabular-nums">{p.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                        {p.probability != null && (
                          <p className="text-siren-text-secondary text-xs mt-1">Market: {p.probability.toFixed(0)}% YES</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="font-heading font-semibold text-siren-bags text-sm uppercase tracking-wider">Token Holdings</h2>
              </div>
              <div className="p-6">
                {tokensLoading ? (
                  <p className="text-siren-text-secondary text-sm">Loading…</p>
                ) : tokenHoldings.length === 0 ? (
                  <p className="text-siren-text-secondary text-sm">No tokens yet. Buy from the terminal or Trending.</p>
                ) : (
                  <ul className="space-y-3">
                    {tokenHoldings.map((t) => (
                      <li
                        key={t.mint}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4 hover:border-siren-bags/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-heading font-medium text-siren-text-primary truncate">{t.symbol !== "—" ? t.symbol : t.mint.slice(0, 8) + "…"}</p>
                          <p className="text-siren-text-secondary text-xs truncate">{t.name !== "Unknown" ? t.name : t.mint}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-data text-siren-bags tabular-nums">{t.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                          <button
                            type="button"
                            onClick={() => openSellPanel(t.mint, t.symbol, t.name)}
                            className="mt-1 text-xs text-siren-primary hover:text-siren-bags transition-colors"
                          >
                            Sell
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="font-heading font-semibold text-siren-primary text-sm uppercase tracking-wider">Fee Earnings</h2>
              </div>
              <div className="p-6">
                <p className="text-siren-text-secondary text-sm">Builder Code (Kalshi) + partner fees will appear here.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
