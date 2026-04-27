"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

const STORAGE_KEY = "siren.markets-cache.v1";

function getBrowserStorages(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

function readStoredMarkets(): { data: MarketWithVelocity[]; updatedAt: number } | null {
  for (const storage of getBrowserStorages()) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: unknown };
      if (!Array.isArray(parsed?.data) || typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) {
        continue;
      }
      return {
        data: parsed.data as MarketWithVelocity[],
        updatedAt: parsed.updatedAt,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function writeStoredMarkets(data: MarketWithVelocity[]) {
  const payload = JSON.stringify({
    updatedAt: Date.now(),
    data,
  });

  for (const storage of getBrowserStorages()) {
    try {
      storage.setItem(STORAGE_KEY, payload);
    } catch {
      /* ignore storage failures */
    }
  }
}

async function fetchMarkets(): Promise<MarketWithVelocity[]> {
  const cached = readStoredMarkets();

  try {
    const response = await fetch(`${API_URL}/api/markets`, { credentials: "omit" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Markets API error: ${response.status}`);
    }

    const markets = Array.isArray(body.data) ? (body.data as MarketWithVelocity[]) : [];
    if (markets.length > 0) return markets;
    if (cached?.data?.length) return cached.data;
    return markets;
  } catch (error) {
    if (cached?.data?.length) return cached.data;
    throw error;
  }
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
