"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketTradeActivity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchMarketActivity(ticker: string): Promise<MarketTradeActivity> {
  const res = await fetch(`${API_URL}/api/markets/${encodeURIComponent(ticker)}/activity`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Market activity API error: ${res.status}`);
  return body.data;
}

export function useMarketActivity(ticker?: string) {
  return useQuery({
    queryKey: ["market-activity", ticker],
    queryFn: () => fetchMarketActivity(ticker!),
    enabled: !!ticker,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
