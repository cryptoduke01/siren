"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

async function fetchMarketByTicker(ticker: string): Promise<MarketWithVelocity> {
  const res = await fetch(`${API_URL}/api/markets/${encodeURIComponent(ticker)}`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Market detail API error: ${res.status}`);
  return body.data as MarketWithVelocity;
}

export function useMarketByTicker(ticker?: string) {
  return useQuery({
    queryKey: ["market-by-ticker", ticker],
    queryFn: () => fetchMarketByTicker(ticker!),
    enabled: !!ticker,
    retry: 1,
    staleTime: 45_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
}
