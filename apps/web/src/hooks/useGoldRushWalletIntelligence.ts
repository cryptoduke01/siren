"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type GoldRushWalletIntelligence = {
  wallet: string;
  quoteCurrency: string;
  updatedAt: string | null;
  summary: {
    tokenCount: number;
    stablecoinUsd: number;
    nativeSolUsd: number;
    totalQuotedUsd: number;
    concentrationPct: number;
  };
  holdings: Array<{
    symbol: string;
    name: string;
    quoteUsd: number;
    prettyQuote: string | null;
    balance: string;
    decimals: number;
    contractAddress: string | null;
    logoUrl: string | null;
    isStable: boolean;
    isNative: boolean;
  }>;
  narrative: {
    reserveRead: string;
    concentrationRead: string;
    readiness: string;
  };
};

async function fetchGoldRushWalletIntelligence(wallet: string): Promise<GoldRushWalletIntelligence> {
  const res = await fetch(`${API_URL}/api/integrations/goldrush/wallet-intelligence?wallet=${encodeURIComponent(wallet)}`, {
    credentials: "omit",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `GoldRush wallet intelligence API error: ${res.status}`);
  return body.data as GoldRushWalletIntelligence;
}

export function useGoldRushWalletIntelligence(wallet?: string | null) {
  return useQuery({
    queryKey: ["goldrush-wallet-intelligence", wallet],
    queryFn: () => fetchGoldRushWalletIntelligence(wallet!),
    enabled: !!wallet,
    retry: 1,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}
