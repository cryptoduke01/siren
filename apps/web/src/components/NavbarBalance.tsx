"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RefreshCw } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { fetchSolPriceUsd, SOL_PRICE_QUERY_KEY } from "@/lib/pricing";
import { API_URL } from "@/lib/apiUrl";

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export function NavbarBalance() {
  const { connected, publicKey } = useSirenWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: SOL_PRICE_QUERY_KEY,
    queryFn: () => fetchSolPriceUsd(API_URL),
    staleTime: 120_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
  });

  const { data: balances } = useQuery({
    queryKey: ["navbar-total-balance", publicKey?.toBase58()],
    enabled: connected && !!publicKey,
    queryFn: async () => {
      if (!publicKey) return { sol: 0, usdc: 0, usdt: 0 };
      const [lamports, usdcAccounts, usdtAccounts] = await Promise.all([
        connection.getBalance(publicKey as PublicKey),
        connection.getParsedTokenAccountsByOwner(publicKey as PublicKey, { mint: new PublicKey(SOLANA_USDC_MINT) }),
        connection.getParsedTokenAccountsByOwner(publicKey as PublicKey, { mint: new PublicKey(SOLANA_USDT_MINT) }),
      ]);
      const extractUi = (accts: typeof usdcAccounts): number =>
        accts.value.reduce((sum, { account }) => {
          const parsed = account.data as { parsed?: { info?: { tokenAmount?: { uiAmount: number | null } } } };
          return sum + (parsed.parsed?.info?.tokenAmount?.uiAmount ?? 0);
        }, 0);
      return { sol: lamports / LAMPORTS_PER_SOL, usdc: extractUi(usdcAccounts), usdt: extractUi(usdtAccounts) };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (!connected || !publicKey) return null;

  const sol = balances?.sol ?? 0;
  const usdc = balances?.usdc ?? 0;
  const usdt = balances?.usdt ?? 0;
  const totalUsd = (solPriceUsd > 0 ? sol * solPriceUsd : 0) + usdc + usdt;

  const refreshBalances = () => {
    queryClient.invalidateQueries({ queryKey: ["navbar-total-balance"] });
    queryClient.invalidateQueries({ queryKey: [SOL_PRICE_QUERY_KEY[0]] });
  };

  return (
    <button
      type="button"
      onClick={refreshBalances}
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-xs hover:brightness-110 transition-all"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ color: "var(--accent)" }}>
        ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <RefreshCw className="h-2.5 w-2.5" style={{ color: "var(--text-3)" }} />
    </button>
  );
}
