"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import { TopBar } from "@/components/TopBar";
import { useSirenStore } from "@/store/useSirenStore";

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
                <h2 className="font-heading font-semibold text-siren-kalshi text-sm uppercase tracking-wider">Kalshi Positions</h2>
              </div>
              <div className="p-6">
                <p className="text-siren-text-secondary text-sm">No open positions. Trade via the terminal.</p>
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
