"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarketWithVelocity } from "@siren/shared";
import { API_URL } from "@/lib/apiUrl";

function normalizeTickerKey(value?: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

function findMarketInFeed(markets: MarketWithVelocity[], ticker: string): MarketWithVelocity | undefined {
  const normalizedTicker = normalizeTickerKey(ticker);
  if (!normalizedTicker) return undefined;

  const direct = markets.find((market) => {
    return [
      normalizeTickerKey(market.ticker),
      normalizeTickerKey(market.platform_id),
      normalizeTickerKey(market.event_ticker),
      normalizeTickerKey(market.condition_id),
    ].includes(normalizedTicker);
  });
  if (direct) return direct;

  const grouped = markets.find((market) =>
    market.outcomes?.some((outcome) => normalizeTickerKey(outcome.ticker) === normalizedTicker),
  );
  if (!grouped) return undefined;

  const outcome = grouped.outcomes?.find((entry) => normalizeTickerKey(entry.ticker) === normalizedTicker);
  if (!outcome) return grouped;

  return {
    ...grouped,
    ticker: outcome.ticker ?? grouped.ticker,
    platform_id: outcome.ticker ?? grouped.platform_id,
    market_url: outcome.market_url ?? grouped.market_url,
    kalshi_url: outcome.market_url ?? grouped.kalshi_url,
    probability: outcome.probability ?? grouped.probability,
    subtitle: outcome.subtitle ?? grouped.subtitle,
    volume: outcome.volume ?? grouped.volume,
    volume_24h: outcome.volume_24h ?? grouped.volume_24h,
    liquidity: outcome.liquidity ?? grouped.liquidity,
    open_interest: outcome.open_interest ?? grouped.open_interest,
    yes_mint: outcome.yes_mint,
    no_mint: outcome.no_mint,
    yes_token_id: outcome.yes_token_id,
    no_token_id: outcome.no_token_id,
    selected_outcome_label: outcome.label,
  };
}

async function fetchMarketByTicker(ticker: string): Promise<MarketWithVelocity> {
  const res = await fetch(`${API_URL}/api/markets/${encodeURIComponent(ticker)}`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Market detail API error: ${res.status}`);
  return body.data as MarketWithVelocity;
}

export function useMarketByTicker(ticker?: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["market-by-ticker", ticker],
    queryFn: () => fetchMarketByTicker(ticker!),
    enabled: !!ticker,
    retry: 1,
    staleTime: 45_000,
    gcTime: 30 * 60_000,
    initialData: () => {
      if (!ticker) return undefined;
      const markets = queryClient.getQueryData<MarketWithVelocity[]>(["markets"]) ?? [];
      return findMarketInFeed(markets, ticker);
    },
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
}
