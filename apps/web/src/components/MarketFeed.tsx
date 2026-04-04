"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { MarketFilterSheet, type MarketFeedSortMode } from "./MarketFilterSheet";
import { ImmersiveMarketCard } from "./ImmersiveMarketCard";
import { Search, SlidersHorizontal, X } from "lucide-react";
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

  const { data: markets = [], isLoading, isError, refetch } = useMarkets();
  const { signals, status: signalStatus } = useSignals();

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

  const { data: serverSearchResults = [] } = useQuery({
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

  const filtered = useMemo(() => {
    let list = markets.filter((m) => marketMatchesTimePreset(m, timePreset));
    list = list.filter((m) => marketMatchesCategory(m, category));
    if (source !== "all") {
      list = list.filter((m) => m.source === source);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
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

    if (searchQuery.trim() && sorted.length < 5 && serverSearchResults.length > 0) {
      const existingTickers = new Set(sorted.map((m) => m.ticker));
      const extra = serverSearchResults.filter((m) => !existingTickers.has(m.ticker));
      sorted.push(...extra);
    }

    return sorted;
  }, [markets, timePreset, category, source, searchQuery, sortMode, hotSignalTickers, serverSearchResults]);

  const handleSelectMarket = (m: MarketWithVelocity) => {
    hapticLight();
    setSelectedMarket(toSelectedMarket(m));
    onAfterSelectMarket?.(m);
  };

  const handleSelectSignal = (signal: PredictionSignal) => {
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
  };

  const signalCount = liveSignals.length;
  const kalshiUp = signalStatus.find((s) => s.source === "kalshi")?.connected;
  const polyUp = signalStatus.find((s) => s.source === "polymarket")?.connected;
  const filterActive = activeFilterCount(timePreset, category, source, sortMode);

  return (
    <div className="h-full flex flex-col overflow-hidden min-h-0" style={{ background: "var(--bg-base)" }}>
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2.5 h-10 px-3 rounded-2xl border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-3)" }} />
            <input
              type="text"
              placeholder="Search markets, tickers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent font-body text-xs outline-none placeholder:text-[var(--text-3)]"
              style={{ color: "var(--text-1)" }}
            />
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
            className="relative h-10 px-3 rounded-2xl border flex items-center gap-2 shrink-0 transition-colors"
            style={{
              background: "var(--bg-surface)",
              borderColor: filterActive ? "#ff7a18" : "var(--border-subtle)",
              color: "var(--text-2)",
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {filterActive > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full font-mono text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#ff7a18", color: "#0a0a0a" }}
              >
                {filterActive}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="font-body text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Scroll the feed — pick a side on any card. Multi-outcome events show every price inline.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {kalshiUp != null && (
              <span className="flex items-center gap-1 font-body text-[9px]" style={{ color: "var(--text-3)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: kalshiUp ? "var(--up)" : "var(--down)" }} />
                K
              </span>
            )}
            {polyUp != null && (
              <span className="flex items-center gap-1 font-body text-[9px]" style={{ color: "var(--text-3)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: polyUp ? "var(--up)" : "var(--down)" }} />
                PM
              </span>
            )}
            {signalCount > 0 && (
              <span className="font-body text-[9px] tabular-nums font-semibold" style={{ color: "var(--up)" }}>
                {signalCount} live
              </span>
            )}
          </div>
        </div>
      </div>

      {liveSignals.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hidden pb-1 snap-x snap-mandatory">
            {liveSignals
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 8)
              .map((sig) => (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => handleSelectSignal(sig)}
                  className="shrink-0 snap-start rounded-2xl border px-3 py-2 text-left transition-colors hover:border-[var(--border-active)]"
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
            className="px-5 py-2.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wide border"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3 px-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card rounded-[22px]" style={{ height: 200 }} />
          ))}
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-3 pb-6 space-y-4 snap-y snap-proximity">
          <AnimatePresence mode="popLayout">
            {filtered.slice(0, shownCount).map((m, i) => {
              const isSelected = selectedMarket?.ticker === m.ticker;
              const isHot = hotSignalTickers.has(m.platform_id ?? m.ticker);
              return (
                <motion.li
                  key={m.ticker}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.12) }}
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
                className="w-full py-3 rounded-2xl font-heading text-xs font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
              >
                Load more ({filtered.length - shownCount} left)
              </button>
            </li>
          )}
          {filtered.length === 0 && !isLoading && (
            <li className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
                Nothing matches these filters. Open filters and widen time or category.
              </p>
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
