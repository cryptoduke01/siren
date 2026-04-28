"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import type { MarketOutcome, MarketWithVelocity } from "@siren/shared";
import { CenteredLoaderState } from "@/components/CenteredLoaderState";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { useSirenStore } from "@/store/useSirenStore";
import { useExplorerStore } from "@/store/useExplorerStore";
import { toSelectedMarket } from "@/lib/marketSelection";
import {
  compareMarketExplorerSecondaryPriority,
  inferMarketCategory,
  marketCategoryBadgeStyle,
  marketCategoryLabel,
  marketExplorerPriorityScore,
  marketHoursUntilClose,
  marketMatchesCategory,
  type MarketCategoryId,
  type MarketSourceFilter,
} from "@/lib/marketFeedFilters";
import { hapticLight } from "@/lib/haptics";

const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;
const SOURCE_TABS: Array<{ id: MarketSourceFilter; label: string }> = [
  { id: "all", label: "All venues" },
  { id: "kalshi", label: "Kalshi" },
  { id: "polymarket", label: "Polymarket" },
];
const CATEGORY_TABS: Array<{ id: MarketCategoryId; label: string }> = [
  { id: "all", label: "Trending" },
  { id: "sports", label: "Sports" },
  { id: "politics", label: "Politics" },
  { id: "crypto", label: "Crypto" },
  { id: "finance", label: "Finance" },
  { id: "entertainment", label: "Entertainment" },
];
const INITIAL_VISIBLE = 18;
const VISIBLE_STEP = 12;

function shouldShowInDefaultExplorer(market: MarketWithVelocity): boolean {
  const hoursUntilClose = marketHoursUntilClose(market);
  const recentVolume = market.volume_24h ?? market.volume ?? 0;
  const depth = market.source === "polymarket" ? market.liquidity ?? 0 : market.open_interest ?? 0;
  const activeSignal = Math.abs(market.velocity_1h ?? 0) >= 0.5;

  if (hoursUntilClose == null) {
    return recentVolume >= 25_000 || activeSignal;
  }
  if (hoursUntilClose <= 0) return false;
  if (hoursUntilClose > 24 * 365) return false;
  if (hoursUntilClose > 24 * 180) {
    return activeSignal && (recentVolume >= 75_000 || depth >= 150_000);
  }
  if (hoursUntilClose > 24 * 90) {
    return activeSignal || recentVolume >= 50_000 || depth >= 100_000;
  }
  return true;
}

function formatCompactNumber(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCloseLabel(value?: number | null, multiOutcome = false): string {
  if (!value || !Number.isFinite(value)) {
    return multiOutcome ? "Ends by outcome" : "Open";
  }

  const timestampMs = value < 1_000_000_000_000 ? value * 1000 : value;
  return `Ends ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestampMs)}`;
}

function sourceTone(source?: string) {
  if (source === "polymarket") {
    return {
      label: "Polymarket",
      bg: "color-mix(in srgb, var(--polymarket) 12%, var(--bg-surface))",
      color: "var(--polymarket)",
      border: "color-mix(in srgb, var(--polymarket) 28%, transparent)",
    };
  }

  return {
    label: "Kalshi",
    bg: "color-mix(in srgb, var(--kalshi) 12%, var(--bg-surface))",
    color: "var(--kalshi)",
    border: "color-mix(in srgb, var(--kalshi) 28%, transparent)",
  };
}

function topOutcomes(market: MarketWithVelocity): MarketOutcome[] {
  if (!market.outcomes?.length) return [];
  return [...market.outcomes].sort((left, right) => (right.probability ?? 0) - (left.probability ?? 0)).slice(0, 4);
}

const MarketExplorerCard = memo(function MarketExplorerCard({
  market,
  onOpen,
}: {
  market: MarketWithVelocity;
  onOpen: (market: MarketWithVelocity) => void;
}) {
  const source = sourceTone(market.source);
  const category = inferMarketCategory(market);
  const multiOutcome = !!(market.outcomes && market.outcomes.length > 1);
  const outcomes = topOutcomes(market);
  const remainingOutcomeCount = Math.max(0, (market.outcomes?.length ?? 0) - outcomes.length);
  const yesProbability = Math.min(100, Math.max(0, market.probability));
  const noProbability = Math.min(100, Math.max(0, 100 - yesProbability));

  return (
    <button
      type="button"
      onClick={() => onOpen(market)}
      className="group w-full rounded-[20px] border p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 md:p-4"
      style={{
        borderColor: "var(--border-subtle)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 96%, transparent), var(--bg-base))",
        boxShadow: "0 16px 36px -34px rgba(0,0,0,0.45)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {category && (
          <span
            className="rounded-full px-2.5 py-1 font-label text-[11px] uppercase tracking-[0.12em]"
            style={{ background: marketCategoryBadgeStyle(category).bg, color: marketCategoryBadgeStyle(category).color }}
          >
            {marketCategoryLabel(category)}
          </span>
        )}
        <span
          className="rounded-full border px-2.5 py-1 font-label text-[11px] uppercase tracking-[0.12em]"
          style={{ background: source.bg, color: source.color, borderColor: source.border }}
        >
          {source.label}
        </span>
        {multiOutcome && (
          <span
            className="rounded-full border px-2.5 py-1 font-label text-[11px] uppercase tracking-[0.12em]"
            style={{ background: "var(--bg-surface)", color: "var(--text-3)", borderColor: "var(--border-subtle)" }}
          >
            {market.outcomes?.length} outcomes
          </span>
        )}
      </div>

      <h3
        className="mt-3 line-clamp-2 max-w-[24ch] font-heading text-[1.08rem] font-bold leading-[1.14] tracking-[-0.012em] md:text-[1.16rem]"
        style={{ color: "var(--text-1)" }}
        title={market.title}
      >
        {market.title}
      </h3>

      {multiOutcome ? (
        <div className="mt-4 space-y-2">
          {outcomes.map((outcome) => (
            <div
              key={outcome.ticker ?? outcome.label}
              className="flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <p className="min-w-0 truncate font-body text-sm" style={{ color: "var(--text-1)" }}>
                {outcome.label}
              </p>
              <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                {outcome.probability.toFixed(0)}%
              </span>
            </div>
          ))}
          {remainingOutcomeCount > 0 && (
            <div className="rounded-[14px] border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-3)" }}>
              +{remainingOutcomeCount} more outcomes
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] border px-3.5 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--up) 22%, transparent)", background: "color-mix(in srgb, var(--up) 5%, var(--bg-surface))" }}>
            <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
              Yes
            </p>
            <p className="mt-2 font-mono text-[1.25rem] font-semibold tabular-nums" style={{ color: "var(--up)" }}>
              {yesProbability.toFixed(0)}%
            </p>
          </div>
          <div className="rounded-[16px] border px-3.5 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--down) 22%, transparent)", background: "color-mix(in srgb, var(--down) 5%, var(--bg-surface))" }}>
            <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
              No
            </p>
            <p className="mt-2 font-mono text-[1.25rem] font-semibold tabular-nums" style={{ color: "var(--down)" }}>
              {noProbability.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
            24h volume
          </p>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.volume_24h ?? market.volume) === "—" ? "—" : `$${formatCompactNumber(market.volume_24h ?? market.volume)}`}
          </p>
        </div>
        <div className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
            {market.source === "polymarket" ? "Liquidity" : "Open interest"}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
            {formatCompactNumber(market.source === "polymarket" ? market.liquidity : market.open_interest)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="font-body text-[13px]" style={{ color: "var(--text-3)" }}>
          {formatCloseLabel(market.close_time, multiOutcome)}
        </p>
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-label text-[11px] uppercase tracking-[0.12em] transition-colors group-hover:border-[var(--accent)]"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
        >
          Open market
        </span>
      </div>
    </button>
  );
});

export function TerminalMarketExplorer() {
  const router = useRouter();
  const { data: markets = [], isLoading, isFetching, isError, refetch } = useMarkets();
  const { signals } = useSignals();
  const { setSelectedMarket } = useSirenStore();
  const { query, setQuery, source, setSource, category, setCategory } = useExplorerStore();
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const liveSignals = useMemo(
    () => signals.filter((signal) => Date.now() - Date.parse(signal.timestamp) <= LIVE_SIGNAL_WINDOW_MS),
    [signals],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return markets
      .filter((market) => (source === "all" ? true : market.source === source))
      .filter((market) => marketMatchesCategory(market, category))
      .filter((market) => (normalizedQuery ? true : shouldShowInDefaultExplorer(market)))
      .filter((market) => {
        if (!normalizedQuery) return true;
        return (
          market.title.toLowerCase().includes(normalizedQuery) ||
          market.ticker.toLowerCase().includes(normalizedQuery) ||
          market.subtitle?.toLowerCase().includes(normalizedQuery) ||
          market.outcomes?.some((outcome) => outcome.label.toLowerCase().includes(normalizedQuery))
        );
      })
      .sort((left, right) => {
        const leftMoving = liveSignals.some((signal) => signal.marketId === (left.platform_id ?? left.ticker));
        const rightMoving = liveSignals.some((signal) => signal.marketId === (right.platform_id ?? right.ticker));
        if (leftMoving !== rightMoving) return rightMoving ? 1 : -1;
        const scoreDiff = marketExplorerPriorityScore(right) - marketExplorerPriorityScore(left);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        const closeDiff = (marketHoursUntilClose(left) ?? Number.POSITIVE_INFINITY) - (marketHoursUntilClose(right) ?? Number.POSITIVE_INFINITY);
        if (Math.abs(closeDiff) > 1) return closeDiff;
        return compareMarketExplorerSecondaryPriority(left, right);
      });
  }, [markets, source, category, deferredQuery, liveSignals]);

  const visibleMarkets = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const showWarmLoader = !isError && markets.length === 0 && (isLoading || isFetching);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [deferredQuery, source, category]);

  const openMarket = (market: MarketWithVelocity) => {
    hapticLight();
    setSelectedMarket(toSelectedMarket(market));
    router.push(`/market/${encodeURIComponent(market.ticker)}`);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-3 py-4 md:px-5 md:py-6">
      <div className="rounded-[22px] border p-3.5 md:p-5" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))" }}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
                Market feed
              </p>
              <p className="mt-2 font-heading text-[1.15rem] font-bold leading-[1.12] tracking-[-0.012em] md:text-[1.5rem]" style={{ color: "var(--text-1)" }}>
                Current markets first
              </p>
              <p className="mt-3 font-body text-[13px] leading-[1.6] md:text-sm" style={{ color: "var(--text-2)" }}>
                Nearer-term, tradeable books rise first here. Search if you want the long-dated fringe, but the default view now stays focused on markets people can actually work with.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:w-[390px]">
              {[
                { label: "Tracked", value: filtered.length.toLocaleString(), detail: "books in this view" },
                { label: "Moving", value: liveSignals.length.toLocaleString(), detail: "signals in the last 30m" },
                { label: "Venues", value: "2", detail: "Kalshi + Polymarket" },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] border px-2.5 py-2.5 md:px-3.5 md:py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  <p className="font-label text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
                    {item.label}
                  </p>
                  <p className="mt-1.5 font-heading text-base font-bold leading-[1.08] md:text-xl" style={{ color: "var(--text-1)" }}>
                    {item.value}
                  </p>
                  <p className="mt-1 font-body text-[10px] leading-snug md:text-[11px]" style={{ color: "var(--text-3)" }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
              {SOURCE_TABS.map((tab) => {
                const active = tab.id === source;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setSource(tab.id);
                    }}
                    className="rounded-full border px-4 py-2 font-label text-[11px] uppercase tracking-[0.12em] transition-colors"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                      background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-2)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => {
              const active = tab.id === category;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setCategory(tab.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-body text-sm transition-colors"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                    background: active ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" : "var(--bg-surface)",
                    color: active ? "var(--text-1)" : "var(--text-2)",
                  }}
                >
                  {tab.id === "all" && <TrendingUp className="h-4 w-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showWarmLoader ? (
        <CenteredLoaderState
          title="Loading live markets"
          detail="Pulling the latest Kalshi and Polymarket books into Siren."
          phrases={[
            "Checking live Kalshi books",
            "Pulling fresh Polymarket listings",
            "Sorting current opportunities",
            "Preparing execution context",
          ]}
        />
      ) : isError ? (
        <div className="rounded-[28px] border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-heading text-xl font-semibold leading-[1.1] tracking-[-0.01em]" style={{ color: "var(--text-1)" }}>
            Market explorer is unavailable right now.
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Siren could not refresh the live market feed. Retry and we’ll pull the latest Kalshi and Polymarket books again.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              void refetch();
            }}
            className="mt-4 rounded-full border px-4 py-2 font-body text-sm font-semibold"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-surface))" }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 && !(deferredQuery || source !== "all" || category !== "all") ? (
        <CenteredLoaderState
          title="Loading live markets"
          detail="Siren is still warming the live feed. Stay here and the grid will fill in as soon as current books are ready."
          phrases={[
            "Checking live Kalshi books",
            "Pulling fresh Polymarket listings",
            "Sorting current opportunities",
            "Preparing execution context",
          ]}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-heading text-xl font-semibold leading-[1.1] tracking-[-0.01em]" style={{ color: "var(--text-1)" }}>
            No markets match this view yet.
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Clear the search or switch venue/category filters to widen the market set.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMarkets.map((market) => (
            <MarketExplorerCard key={`${market.source}-${market.platform_id ?? market.ticker}`} market={market} onOpen={openMarket} />
          ))}
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setVisibleCount((count) => Math.min(count + VISIBLE_STEP, filtered.length));
                }}
                className="rounded-full border px-5 py-2.5 font-body text-sm font-semibold"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
              >
                Load more markets
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
