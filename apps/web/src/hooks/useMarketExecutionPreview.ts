"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type MarketExecutionPreview = {
  market: {
    ticker: string;
    eventTicker?: string;
    title: string;
    source?: string;
    groupedEvent: boolean;
    outcomeCount: number;
    selectedOutcome: {
      ticker: string;
      label: string;
      probability: number;
      priceUsd: number;
    };
    stats: {
      liquidity: number | null;
      volume24h: number | null;
      openInterest: number | null;
    };
  };
  route: {
    available: boolean;
    mode: "siren" | "venue_only";
    summary: string;
    suggestedClipUsd: number | null;
    walletConnected: boolean;
    actionable: string;
    probes: Array<{
      amountUsd: number;
      status: "routable" | "failed" | "skipped";
      reason: string | null;
    }>;
  };
  risk: {
    resolution: {
      level: string;
      label: string;
      hoursLeft: number | null;
      summary: string;
    };
    field: {
      rank: number;
      leaderGapPct: number;
      topThreeSharePct: number;
      label: string;
      summary: string;
    };
  };
};

async function fetchMarketExecutionPreview({
  ticker,
  outcomeTicker,
  wallet,
}: {
  ticker: string;
  outcomeTicker?: string;
  wallet?: string | null;
}): Promise<MarketExecutionPreview> {
  const params = new URLSearchParams();
  if (outcomeTicker) params.set("outcomeTicker", outcomeTicker);
  if (wallet) params.set("wallet", wallet);

  const res = await fetch(
    `${API_URL}/api/markets/${encodeURIComponent(ticker)}/execution-preview${params.toString() ? `?${params.toString()}` : ""}`,
    { credentials: "omit" },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Execution preview API error: ${res.status}`);
  return body.data as MarketExecutionPreview;
}

export function useMarketExecutionPreview({
  ticker,
  outcomeTicker,
  wallet,
}: {
  ticker?: string;
  outcomeTicker?: string;
  wallet?: string | null;
}) {
  return useQuery({
    queryKey: ["market-execution-preview", ticker, outcomeTicker, wallet],
    queryFn: () => fetchMarketExecutionPreview({ ticker: ticker!, outcomeTicker, wallet }),
    enabled: !!ticker,
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
}
