"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PredictionSignal, SignalSourceStatus } from "@siren/shared";
import { API_URL, WS_URL } from "@/lib/apiUrl";
const QUERY_KEY = ["signals-feed"] as const;

export interface SignalFeedResponse {
  signals: PredictionSignal[];
  status: SignalSourceStatus[];
  updatedAt?: string;
}

const EMPTY_SIGNAL_FEED: SignalFeedResponse = {
  signals: [],
  status: [
    { source: "kalshi", connected: false },
    { source: "polymarket", connected: false },
  ],
};

async function fetchSignals(): Promise<SignalFeedResponse> {
  const response = await fetch(`${API_URL}/api/signals`, { credentials: "omit" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Signals API error: ${response.status}`);
  }

  return {
    signals: Array.isArray(body.data) ? body.data : [],
    status: Array.isArray(body.status) ? body.status : EMPTY_SIGNAL_FEED.status,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : undefined,
  };
}

export function useSignals({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSignals,
    enabled,
    refetchInterval: enabled ? 90_000 : false,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled) return;

    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string; data?: unknown };
        queryClient.setQueryData<SignalFeedResponse>(QUERY_KEY, (current) => {
          const base = current ?? EMPTY_SIGNAL_FEED;

          if (message.type === "signals") {
            return {
              ...base,
              signals: Array.isArray(message.data) ? (message.data as PredictionSignal[]) : base.signals,
              updatedAt: new Date().toISOString(),
            };
          }

          if (message.type === "signal-status") {
            return {
              ...base,
              status: Array.isArray(message.data) ? (message.data as SignalSourceStatus[]) : base.status,
              updatedAt: new Date().toISOString(),
            };
          }

          return base;
        });
      } catch {
        /* Ignore malformed websocket payloads. */
      }
    };

    return () => socket.close();
  }, [enabled, queryClient]);

  return {
    ...query,
    signals: query.data?.signals ?? EMPTY_SIGNAL_FEED.signals,
    status: query.data?.status ?? EMPTY_SIGNAL_FEED.status,
  };
}
