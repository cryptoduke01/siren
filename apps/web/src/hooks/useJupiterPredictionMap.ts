"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type JupiterPredictionMap = {
  query: string;
  providers: Array<{
    provider: "kalshi" | "polymarket";
    events: Array<{
      eventId: string;
      title: string;
      subtitle: string | null;
      slug: string | null;
      series: string | null;
      closeTime: string | null;
      imageUrl: string | null;
      volumeUsd: number | null;
      isLive: boolean;
      isActive: boolean;
      marketCount: number;
      markets: Array<{
        marketId: string;
        title: string;
        status: string;
        closeTime: number | null;
        yesPriceUsd: number | null;
        noPriceUsd: number | null;
        volume: number | null;
      }>;
    }>;
  }>;
};

async function fetchJupiterPredictionMap({
  title,
  outcomeLabel,
}: {
  title: string;
  outcomeLabel?: string | null;
}): Promise<JupiterPredictionMap> {
  const params = new URLSearchParams({ title });
  if (outcomeLabel) params.set("outcomeLabel", outcomeLabel);
  params.set("limit", "3");

  const res = await fetch(`${API_URL}/api/integrations/jupiter/prediction-map?${params.toString()}`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Jupiter prediction map API error: ${res.status}`);
  return body.data as JupiterPredictionMap;
}

export function useJupiterPredictionMap({
  title,
  outcomeLabel,
}: {
  title?: string;
  outcomeLabel?: string | null;
}) {
  return useQuery({
    queryKey: ["jupiter-prediction-map", title, outcomeLabel],
    queryFn: () => fetchJupiterPredictionMap({ title: title!, outcomeLabel }),
    enabled: !!title,
    retry: 1,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}
