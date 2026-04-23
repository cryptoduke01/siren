"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { MarketFilterSheet, type MarketFeedSortMode } from "./MarketFilterSheet";
import { ImmersiveMarketCard } from "./ImmersiveMarketCard";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";
import type { MarketWithVelocity, PredictionSignal } from "@siren/shared";
import { toSelectedMarket } from "@/lib/marketSelection";
import {
  marketMatchesCategory,
  marketMatchesTimePreset,
  type MarketCategoryId,
  type MarketSourceFilter,
  type MarketTimePreset,
} from "@/lib/marketFeedFilters";

const INITIAL_SHOWN = 15;
const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;

function activeFilterCount(
  timePreset: MarketTimePreset,
  category: MarketCategoryId,
  source: MarketSourceFilter,
  sortMode: MarketFeedSortMode,
): number {
  let n = 0;
  if (timePreset !== "all") n++;
  if (category !== "all") n++;
  if (source !== "all") n++;
  if (sortMode !== "hot") n++;
  return n;
}

export function MarketFeed({ onAfterSelectMarket }: { onAfterSelectMarket?: (m: MarketWithVelocity) => void } = {}) {
  const { selectedMarket, setSelectedMarket, setSelectedSignal } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [timePreset, setTimePreset] = useState<MarketTimePreset>("all");
  const [category, setCategory] = useState<MarketCategoryId>("all");
  const [source, setSource] = useState<MarketSourceFilter>("all");
  const [sortMode, setSortMode] = useState<MarketFeedSortMode>("hot");
  const reduceMotion = useReducedMotion();

  const { data: markets = [], isLoading, isError, refetch } = useMarkets();
  const { signals, status: signalStatus } = useSignals();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (filterOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [filterOpen]);

  const { data: serverSearchResults = [], isFetching: isSearchingServer } = useQuery({
    queryKey: ["market-search", debouncedQuery],
    queryFn: async (): Promise<MarketWithVelocity[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`${API_URL}/api/markets/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "omit" });
      if (!res.ok) return [];
      const json = await res.json().catch(() => ({}));
      return (json.data ?? []) as MarketWithVelocity[];
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const liveSignals = useMemo(
    () => signals.filter((s) => Date.now() - Date.parse(s.timestamp) <= LIVE_SIGNAL_WINDOW_MS),
    [signals]
  );

  const hotSignalTickers = useMemo(() => {
    const set = new Set<string>();
    for (const s of liveSignals) {
      if (Math.abs(s.delta) >= 3) set.add(s.marketId);
    }
    return set;
  }, [liveSignals]);

  const topLiveSignals = useMemo(
    () => [...liveSignals].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8),
    [liveSignals]
  );

  const filtered = useMemo(() => {
    let list = markets.filter((m) => marketMatchesTimePreset(m, timePreset));
    list = list.filter((m) => marketMatchesCategory(m, category));
    if (source !== "all") {
      list = list.filter((m) => m.source === source);
    }

    if (normalizedQuery) {
      const q = normalizedQuery;
      list = list.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.ticker?.toLowerCase().includes(q) ||
          m.subtitle?.toLowerCase().includes(q)
      );
    }

    const effectiveSort: MarketFeedSortMode | "popular_volume" =
      timePreset === "popular" ? "popular_volume" : sortMode;

    const sorted = [...list];
    switch (effectiveSort) {
      case "popular_volume":
        sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        break;
      case "volume":
        sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        break;
      case "newest":
        sorted.sort((a, b) => (b.open_time ?? 0) - (a.open_time ?? 0));
        break;
      case "ending_soon": {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() + thirtyDaysMs;
        const endingSoon = sorted.filter((m) => m.close_time && m.close_time > Date.now() && m.close_time <= cutoff);
        const theRest = sorted.filter((m) => !m.close_time || m.close_time > cutoff || m.close_time <= Date.now());
        endingSoon.sort((a, b) => (a.close_time ?? 0) - (b.close_time ?? 0));
        sorted.length = 0;
        sorted.push(...endingSoon, ...theRest);
        break;
      }
      case "hot":
      default:
        sorted.sort((a, b) => {
          const aHot = hotSignalTickers.has(a.platform_id ?? a.ticker) ? 1 : 0;
          const bHot = hotSignalTickers.has(b.platform_id ?? b.ticker) ? 1 : 0;
          if (bHot !== aHot) return bHot - aHot;
          const velDiff = Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h);
          if (Math.abs(velDiff) > 0.5) return velDiff;
          return (b.volume ?? 0) - (a.volume ?? 0);
        });
        break;
    }

    if (normalizedQuery && sorted.length < 5 && serverSearchResults.length > 0) {
      const existingTickers = new Set(sorted.map((m) => m.ticker));
      const extra = serverSearchResults.filter((m) => !existingTickers.has(m.ticker));
      sorted.push(...extra);
    }

    return sorted;
  }, [markets, timePreset, category, source, normalizedQuery, sortMode, hotSignalTickers, serverSearchResults]);

  const visibleMarkets = useMemo(() => filtered.slice(0, shownCount), [filtered, shownCount]);

  const handleSelectMarket = useCallback((m: MarketWithVelocity) => {
    hapticLight();
    setSelectedMarket(toSelectedMarket(m));
    onAfterSelectMarket?.(m);
  }, [setSelectedMarket, onAfterSelectMarket]);

  const handleSelectSignal = useCallback((signal: PredictionSignal) => {
    hapticLight();
    const linked = markets.find(
      (m) => m.source === signal.source && (m.platform_id === signal.marketId || m.ticker === signal.marketId)
    );
    if (linked) {
      setSelectedMarket(toSelectedMarket(linked));
      onAfterSelectMarket?.(linked);
    } else {
      setSelectedSignal(signal);
    }
  }, [markets, onAfterSelectMarket, setSelectedMarket, setSelectedSignal]);

  const signalCount = liveSignals.length;
  const kalshiUp = signalStatus.find((s) => s.source === "kalshi")?.connected;
  const polyUp = signalStatus.find((s) => s.source === "polymarket")?.connected;
  const filterActive = activeFilterCount(timePreset, category, source, sortMode);
  const hasQuery = normalizedQuery.length > 0;
  const hasRecoveryActions = hasQuery || filterActive > 0;

  const resetDiscovery = useCallback(() => {
    hapticLight();
    setSearchQuery("");
    setTimePreset("all");
    setCategory("all");
    setSource("all");
    setSortMode("hot");
    setShownCount(INITIAL_SHOWN);
  }, []);

  useEffect(() => {
    setShownCount(INITIAL_SHOWN);
  }, [normalizedQuery, timePreset, category, source, sortMode]);

  return (
    <div className="h-full flex flex-col overflow-hidden min-h-0" style={{ background: "var(--bg-base)" }}>
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2.5 md:px-4 md:pt-4">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold tracking-[-0.02em] leading-none" style={{ color: "var(--text-1)" }}>
              Markets
            </p>
            <p className="mt-1 font-body text-[10px] md:text-[11px]" style={{ color: "var(--text-3)" }}>
              {filtered.length.toLocaleString()} shown{shownCount < filtered.length ? ` • ${shownCount.toLocaleString()} loaded` : ""} • {signalCount.toLocaleString()} moving
            </p>
          </div>
          {hasRecoveryActions && (
            <button
              type="button"
              onClick={resetDiscovery}
              className="shrink-0 rounded-full border px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--border-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2.5 h-10 md:h-11 px-3 md:px-3.5 rounded-2xl border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-3)" }} />
            <input
              type="text"
              placeholder="Search Markets"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent font-body text-xs md:text-[13px] outline-none placeholder:text-[var(--text-3)]"
              style={{ color: "var(--text-1)" }}
            />
            {isSearchingServer && debouncedQuery.length >= 2 && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-3)" }} />
            )}
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFilterOpen(true);
            }}
            className="relative h-10 md:h-11 px-3.5 rounded-2xl border flex items-center gap-2 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            style={{
              background: "var(--bg-surface)",
              borderColor: filterActive ? "var(--accent)" : "var(--border-subtle)",
              color: "var(--text-2)",
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {filterActive > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full font-mono text-[10px] font-bold flex items-center justify-center"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {filterActive}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {source !== "all" && (
              <span className="inline-flex items-center rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}>
                {source}
              </span>
            )}
            {timePreset !== "all" && (
              <span className="inline-flex items-center rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}>
                {timePreset.replaceAll("_", " ")}
              </span>
            )}
            {category !== "all" && (
              <span className="inline-flex items-center rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}>
                {category.replaceAll("_", " ")}
              </span>
            )}
            {sortMode !== "hot" && timePreset !== "popular" && (
              <span className="inline-flex items-center rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}>
                {sortMode.replaceAll("_", " ")}
              </span>
            )}
            {!hasRecoveryActions && (
              <p className="font-body text-[10px] md:text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                Search + filters route you to execution faster.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {kalshiUp != null && (
              <span className="flex items-center gap-1 font-body text-[9px]" style={{ color: "var(--text-3)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: kalshiUp ? "var(--up)" : "var(--down)" }} />
                <img src="/brand/kalshi/logo-green.svg" alt="" className="h-2.5 w-auto opacity-80" />
              </span>
            )}
            {polyUp != null && (
              <span className="flex items-center gap-1 font-body text-[9px]" style={{ color: "var(--text-3)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: polyUp ? "var(--up)" : "var(--down)" }} />
                <img src="/brand/polymarket/icon-white.svg" alt="" className="h-2.5 w-2.5 opacity-75" />
              </span>
            )}
          </div>
        </div>
      </div>

      {liveSignals.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="flex items-center justify-between px-0.5 pb-1">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
              Live movers
            </p>
            <p className="font-body text-[10px]" style={{ color: "var(--text-3)" }}>
              top {Math.min(8, topLiveSignals.length)}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hidden pb-1 snap-x snap-mandatory">
            {topLiveSignals.map((sig) => (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => handleSelectSignal(sig)}
                  className="shrink-0 snap-start rounded-2xl border px-3 py-2 text-left transition-colors hover:border-[var(--border-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                    minWidth: 168,
                    maxWidth: 220,
                  }}
                >
                  <span
                    className="font-mono text-xs font-bold tabular-nums"
                    style={{ color: sig.delta >= 0 ? "var(--up)" : "var(--down)" }}
                  >
                    {sig.delta >= 0 ? "+" : ""}
                    {sig.delta.toFixed(1)}%
                  </span>
                  <p className="mt-0.5 font-body text-[10px] leading-tight line-clamp-2" style={{ color: "var(--text-2)" }}>
                    {sig.question}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}

      {isError ? (
        <div className="mx-3 rounded-2xl border p-8 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <p className="font-body text-sm mb-4" style={{ color: "var(--text-2)" }}>
            Unable to load markets.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              refetch();
            }}
            className="px-5 py-2.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wide border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-1)",
            }}
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3 px-3 md:px-4" aria-live="polite" aria-busy="true">
          <div className="rounded-[22px] border px-4 py-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.12em]">Loading Markets</span>
            </div>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              Pulling current books and routing context into the terminal.
            </p>
            <div className="progress-track mt-4">
              <span className="progress-bar" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[22px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", minHeight: 188 }}>
              <div className="flex items-center justify-between">
                <div className="loader-line w-20" />
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
              <div className="mt-5 space-y-3">
                <div className="loader-line w-[68%]" />
                <div className="loader-line w-[56%]" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <div className="loader-box" />
                <div className="loader-box" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-3 pb-6 space-y-4 snap-y snap-proximity md:px-4 md:space-y-5">
          <AnimatePresence mode="popLayout">
            {visibleMarkets.map((m, i) => {
              const isSelected = selectedMarket?.ticker === m.ticker;
              const isHot = hotSignalTickers.has(m.platform_id ?? m.ticker);
              return (
                <motion.li
                  key={m.ticker}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.2, delay: Math.min(i * 0.025, 0.12) }
                  }
                  className="snap-start"
                >
                  <ImmersiveMarketCard
                    market={m}
                    isSelected={isSelected}
                    isHot={isHot}
                    onSelect={() => handleSelectMarket(m)}
                    layout="feed"
                  />
                </motion.li>
              );
            })}
          </AnimatePresence>
          {filtered.length > shownCount && (
            <li>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setShownCount((c) => c + 10);
                }}
                className="w-full py-3 rounded-2xl font-heading text-xs font-bold uppercase tracking-wider border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface)",
                  color: "var(--text-2)",
                }}
              >
                Load more ({filtered.length - shownCount} left)
              </button>
            </li>
          )}
          {filtered.length === 0 && !isLoading && (
            <li className="rounded-2xl border border-dashed p-8 text-center md:p-10" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                No markets match your view
              </p>
              <p className="mt-1 font-body text-sm" style={{ color: "var(--text-3)" }}>
                {hasRecoveryActions
                  ? "Clear search and filters to return to the live feed."
                  : "No markets are available right now. Refresh to try again."}
              </p>
              {hasRecoveryActions ? (
                <button
                  type="button"
                  onClick={resetDiscovery}
                  className="mt-4 inline-flex items-center justify-center rounded-xl border px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-surface)",
                    color: "var(--text-2)",
                  }}
                >
                  Reset view
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    refetch();
                  }}
                  className="mt-4 inline-flex items-center justify-center rounded-xl border px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-surface)",
                    color: "var(--text-2)",
                  }}
                >
                  Refresh markets
                </button>
              )}
            </li>
          )}
        </ul>
      )}

      <MarketFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        timePreset={timePreset}
        setTimePreset={setTimePreset}
        category={category}
        setCategory={setCategory}
        source={source}
        setSource={setSource}
        sortMode={sortMode}
        setSortMode={setSortMode}
      />
      <MarketDetailPanel />
    </div>
  );
}
