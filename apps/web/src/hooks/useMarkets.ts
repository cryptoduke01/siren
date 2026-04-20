"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";
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
    refetchInterval: 90_000,
    retry: 2,
    staleTime: 45_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
}
