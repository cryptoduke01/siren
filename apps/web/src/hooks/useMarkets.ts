"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
function fetchMarkets(): Promise<MarketWithVelocity[]> {
  return fetch(`${API_URL}/api/markets`, { credentials: "omit" })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `Markets API error: ${r.status}`);
      return body;
    })
    .then((j) => j.data ?? []);
}

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: true,
    refetchInterval: 45_000,
    retry: 2,
    staleTime: 15_000,
  });
}
