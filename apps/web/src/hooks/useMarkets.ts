"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

const STORAGE_KEY = "siren.markets-cache.v1";

function readStoredMarkets(): { data: MarketWithVelocity[]; updatedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: unknown };
    if (!Array.isArray(parsed?.data) || typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) {
      return null;
    }
    return {
      data: parsed.data as MarketWithVelocity[],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeStoredMarkets(data: MarketWithVelocity[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        data,
      }),
    );
  } catch {
    /* ignore storage failures */
  }
}

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
  const query = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: true,
    refetchInterval: 90_000,
    retry: 2,
    staleTime: 2 * 60_000,
    gcTime: 30 * 60_000,
    initialData: () => readStoredMarkets()?.data,
    initialDataUpdatedAt: () => readStoredMarkets()?.updatedAt,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data?.length) {
      writeStoredMarkets(query.data);
    }
  }, [query.data]);

  return query;
}
