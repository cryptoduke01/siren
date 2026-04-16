"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type PositionExecutionPreview = {
  mint: string;
  marketTicker?: string | null;
  route: {
    available: boolean;
    summary: string;
    walletConnected: boolean;
    suggestedChunkContracts: number | null;
    chunkPlan: {
      totalContracts: number;
      chunkContracts: number;
      estimatedChunks: number;
    } | null;
    probes: Array<{
      contracts: number;
      status: "routable" | "failed" | "skipped";
      reason: string | null;
    }>;
  };
};

async function fetchPositionExecutionPreview({
  mint,
  wallet,
  balance,
  marketTicker,
}: {
  mint: string;
  wallet?: string | null;
  balance?: number | null;
  marketTicker?: string | null;
}): Promise<PositionExecutionPreview> {
  const params = new URLSearchParams({ mint });
  if (wallet) params.set("wallet", wallet);
  if (typeof balance === "number" && Number.isFinite(balance) && balance > 0) params.set("balance", String(balance));
  if (marketTicker) params.set("marketTicker", marketTicker);

  const res = await fetch(`${API_URL}/api/positions/execution-preview?${params.toString()}`, {
    credentials: "omit",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Position execution preview API error: ${res.status}`);
  return body.data as PositionExecutionPreview;
}

export function usePositionExecutionPreview({
  mint,
  wallet,
  balance,
  marketTicker,
}: {
  mint?: string;
  wallet?: string | null;
  balance?: number | null;
  marketTicker?: string | null;
}) {
  return useQuery({
    queryKey: ["position-execution-preview", mint, wallet, balance, marketTicker],
    queryFn: () => fetchPositionExecutionPreview({ mint: mint!, wallet, balance, marketTicker }),
    enabled: !!mint,
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
}
