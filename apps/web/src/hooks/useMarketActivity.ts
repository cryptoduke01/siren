"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketTradeActivity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

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
