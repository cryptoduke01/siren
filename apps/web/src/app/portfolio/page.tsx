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
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2" style={{ color: "var(--accent)" }}>
          Portfolio
        </h1>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Kalshi positions (DFlow) + token holdings (Jupiter). Fee earnings.
        </p>
        {!connected ? (
          <div
            className="rounded-[8px] border p-8 md:p-12 text-center"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <p className="font-body mb-4" style={{ color: "var(--text-2)" }}>
              Connect your wallet to view positions and balances.
            </p>
            <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
              Connect Phantom, Solflare, or another supported wallet to see mainnet and devnet balances.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div
              className="rounded-[8px] border overflow-hidden"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <h2
                  className="font-heading font-semibold text-xs uppercase"
                  style={{ color: "var(--accent)", letterSpacing: "0.1em" }}
                >
                  Wallet Balance
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {isLoading ? (
                  <div className="col-span-2 font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Loading…
                  </div>
                ) : isError ? (
                  <div className="col-span-2 space-y-2">
                    <p className="font-body text-sm" style={{ color: "var(--down)" }}>
                      Failed to fetch balance.
                    </p>
                    <button
                      onClick={() => refetch()}
                      className="font-body text-sm transition-colors hover:text-[var(--text-1)]"
                      style={{ color: "var(--accent)" }}
                    >
                      Retry
                    </button>
                  </div>
                ) : balances ? (
                  <>
                    <div
                      className="rounded-[6px] border p-4"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                    >
                      <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>
                        Mainnet
                      </p>
                      <p className="font-mono text-lg tabular-nums" style={{ color: "var(--text-1)" }}>
                        {balances.mainnet.toFixed(4)}
                      </p>
                      <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                        SOL
                      </p>
                      <p className="font-mono text-xs mt-1 tabular-nums" style={{ color: "var(--text-2)" }}>
                        ≈ ${(balances.mainnet * solPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </p>
                    </div>
                    <div
                      className="rounded-[6px] border p-4"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                    >
                      <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>
                        Devnet
                      </p>
                      <p className="font-mono text-lg tabular-nums" style={{ color: "var(--text-1)" }}>
                        {balances.devnet.toFixed(4)}
                      </p>
                      <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                        SOL
                      </p>
                    </div>
                    <div className="col-span-2 rounded-[6px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                      <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>
                        Portfolio value (mainnet)
                      </p>
                      <p className="font-mono text-xl tabular-nums" style={{ color: "var(--accent)" }}>
                        ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div
              className="rounded-[8px] border overflow-hidden"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <h2
                  className="font-heading font-semibold text-xs uppercase"
                  style={{ color: "var(--kalshi)", letterSpacing: "0.1em" }}
                >
                  Prediction market positions
                </h2>
              </div>
              <div className="p-4">
                {predictionPositions.length === 0 ? (
                  <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                    No prediction market positions. Buy YES/NO from the terminal.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {predictionPositions.map((p) => (
                      <li
                        key={`${p.ticker}-${p.side}`}
                        className="rounded-[6px] border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          background: "var(--bg-elevated)",
                        }}
                      >
                        <p className="font-heading font-medium text-sm line-clamp-1" style={{ color: "var(--text-1)" }}>
                          {p.title}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span
                            className="text-xs font-body font-medium px-2 py-0.5 rounded-[4px]"
                            style={{
                              background: p.side === "yes" ? "var(--bags-dim)" : "var(--down-dim)",
                              color: p.side === "yes" ? "var(--bags)" : "var(--down)",
                            }}
                          >
                            {p.side.toUpperCase()}
                          </span>
                          <span className="font-mono text-sm tabular-nums" style={{ color: "var(--kalshi)" }}>
                            {p.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        {p.probability != null && (
                          <p className="font-mono text-xs mt-1" style={{ color: "var(--text-3)" }}>
                            Market: {p.probability.toFixed(0)}% YES
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div
              className="rounded-[8px] border overflow-hidden"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <h2
                  className="font-heading font-semibold text-xs uppercase"
                  style={{ color: "var(--bags)", letterSpacing: "0.1em" }}
                >
                  Token Holdings
                </h2>
              </div>
              <div className="p-4">
                {tokensLoading ? (
                  <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                    Loading…
                  </p>
                ) : tokenHoldings.length === 0 ? (
                  <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                    No tokens yet. Buy from the terminal or Trending.
                  </p>
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
                          className="flex items-center justify-between gap-4 rounded-[6px] border p-4 transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
                          style={{
                            borderColor: "var(--border-subtle)",
                            background: "var(--bg-elevated)",
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {info?.imageUrl ? (
                              <img
                                src={info.imageUrl}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-mono text-xs"
                                style={{ background: "var(--border-subtle)", color: "var(--text-3)" }}
                              >
                                {displaySymbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-heading font-medium truncate" style={{ color: "var(--text-1)" }}>
                                {displaySymbol}
                              </p>
                              <p className="font-body text-xs truncate" style={{ color: "var(--text-3)" }}>
                                {displayName !== "Unknown" ? displayName : t.mint}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm tabular-nums" style={{ color: "var(--bags)" }}>
                              {t.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </p>
                            {valueUsd != null && (
                              <p className="font-mono text-xs tabular-nums mt-0.5" style={{ color: "var(--text-2)" }}>
                                ≈ ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => openSellPanel(t.mint, t.symbol, t.name)}
                              className="mt-1 font-body text-xs transition-colors hover:text-[var(--bags)]"
                              style={{ color: "var(--accent)" }}
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

            <div
              className="rounded-[8px] border overflow-hidden"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <h2
                  className="font-heading font-semibold text-xs uppercase"
                  style={{ color: "var(--accent)", letterSpacing: "0.1em" }}
                >
                  Fee Earnings
                </h2>
              </div>
              <div className="p-4">
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
                  Builder Code (Kalshi) + partner fees will appear here.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
