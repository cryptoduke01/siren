"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type JupiterPredictionDepthLevel = {
  priceUsd: number;
  quantity: number;
};

export type JupiterPredictionComparableMarket = {
  marketId: string;
  title: string;
  status: string;
  closeTime: number | null;
  yesPriceUsd: number | null;
  noPriceUsd: number | null;
  sellYesPriceUsd: number | null;
  sellNoPriceUsd: number | null;
  volume: number | null;
  marketUrl: string | null;
  orderbook: {
    bestYesBidUsd: number | null;
    bestNoBidUsd: number | null;
    yesDepth: JupiterPredictionDepthLevel[];
    noDepth: JupiterPredictionDepthLevel[];
    yesTopDepthContracts: number;
    noTopDepthContracts: number;
  } | null;
  comparison: {
    targetProbabilityPct: number | null;
    yesPriceGapPct: number | null;
    summary: string;
    confidence: "high" | "medium" | "low";
  };
  recommendation: string;
};

export type JupiterPredictionMap = {
  query: string;
  tradingActive: boolean;
  providers: Array<{
    provider: "kalshi" | "polymarket";
    events: Array<{
      eventId: string;
      title: string;
      subtitle: string | null;
      slug: string | null;
      eventUrl: string | null;
      series: string | null;
      closeTime: string | null;
      imageUrl: string | null;
      volumeUsd: number | null;
      volume24hUsd: number | null;
      isLive: boolean;
      isActive: boolean;
      marketCount: number;
      markets: JupiterPredictionComparableMarket[];
      primaryMarket: JupiterPredictionComparableMarket | null;
    }>;
  }>;
};

async function fetchJupiterPredictionMap({
  title,
  outcomeLabel,
  probability,
}: {
  title: string;
  outcomeLabel?: string | null;
  probability?: number | null;
}): Promise<JupiterPredictionMap> {
  const params = new URLSearchParams({ title });
  if (outcomeLabel) params.set("outcomeLabel", outcomeLabel);
  if (probability != null && Number.isFinite(probability)) params.set("probability", probability.toString());
  params.set("limit", "2");

  const res = await fetch(`${API_URL}/api/integrations/jupiter/prediction-map?${params.toString()}`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Jupiter prediction map API error: ${res.status}`);
  return body.data as JupiterPredictionMap;
}

export function useJupiterPredictionMap({
  title,
  outcomeLabel,
  probability,
}: {
  title?: string;
  outcomeLabel?: string | null;
  probability?: number | null;
}) {
  return useQuery({
    queryKey: ["jupiter-prediction-map", title, outcomeLabel, probability],
    queryFn: () => fetchJupiterPredictionMap({ title: title!, outcomeLabel, probability }),
    enabled: !!title,
    retry: 1,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}
