"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/store/useToastStore";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity, PredictionSignal, SignalSource } from "@siren/shared";
import { toSelectedMarket } from "@/lib/marketSelection";

const INITIAL_SHOWN = 20;
const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;

type SourceFilter = "all" | "kalshi" | "polymarket";
type SortMode = "hot" | "volume" | "newest" | "ending_soon";

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "hot", label: "Trending" },
  { id: "volume", label: "Volume" },
  { id: "newest", label: "Newest" },
  { id: "ending_soon", label: "Ending soon" },
];

function formatCompact(value?: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCloseTime(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  if (diff < 0) return "Ended";
  if (diff < 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 1000))}m`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 60 * 1000))}h`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.ceil(diff / (24 * 60 * 60 * 1000))}d`;
  const d = new Date(ts);
  const thisYear = new Date().getFullYear();
  if (d.getFullYear() === thisYear) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function VelocityBadge({ v }: { v: number }) {
  if (Math.abs(v) < 0.1) return null;
  const color = v > 0 ? "var(--up)" : "var(--down)";
  const arrow = v > 0 ? "▲" : "▼";
  return (
    <span className="font-body text-[10px] tabular-nums font-semibold" style={{ color }}>
      {arrow} {v > 0 ? "+" : ""}{Math.abs(v).toFixed(1)}%
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (source === "polymarket") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5" style={{ background: "rgba(46,92,255,0.12)" }}>
        <img src="/brand/polymarket/icon-white.svg" alt="" className="h-2.5 w-2.5" />
        <span className="font-body text-[9px] font-bold" style={{ color: "#5B8AFF" }}>Poly</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5" style={{ background: "rgba(9,194,133,0.10)" }}>
      <img src="/brand/kalshi/logo-green.svg" alt="Kalshi" className="h-2.5 w-auto" />
    </span>
  );
}

export function MarketFeed({ onAfterSelectMarket }: { onAfterSelectMarket?: (m: MarketWithVelocity) => void } = {}) {
  const { selectedMarket, setSelectedMarket, setSelectedSignal } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const addToast = useToastStore((s) => s.addToast);
  const { data: markets = [], isLoading, isError, refetch } = useMarkets();
  const { signals, status: signalStatus } = useSignals();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filtersOpen]);

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
    let list = markets;

    if (sourceFilter !== "all") {
      list = list.filter((m) => m.source === sourceFilter);
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

    const sorted = [...list];
    switch (sortMode) {
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
    return sorted;
  }, [markets, sourceFilter, searchQuery, sortMode, hotSignalTickers]);

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

  return (
    <div className="h-full flex flex-col overflow-hidden min-h-0" style={{ background: "var(--bg-base)" }}>
      {/* Header: search + filter */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-lg border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-3)" }} />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent font-body text-[11px] outline-none placeholder:text-[var(--text-3)]"
              style={{ color: "var(--text-1)" }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}>
                <X className="w-3 h-3" style={{ color: "var(--text-3)" }} />
              </button>
            )}
          </div>
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => { hapticLight(); setFiltersOpen(!filtersOpen); }}
              className="h-8 px-2.5 rounded-lg border flex items-center gap-1.5"
              style={{
                background: filtersOpen ? "var(--bg-elevated)" : "var(--bg-surface)",
                borderColor: filtersOpen ? "var(--border-active)" : "var(--border-subtle)",
                color: "var(--text-2)",
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <ChevronDown className={`w-3 h-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-10 z-50 w-48 rounded-xl border p-2 shadow-xl"
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
                >
                  <p className="px-2 py-1 font-body text-[9px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                    Sort by
                  </p>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { hapticLight(); setSortMode(opt.id); setFiltersOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded-md font-body text-[11px] hover:bg-[var(--bg-surface)]"
                      style={{ color: sortMode === opt.id ? "var(--accent)" : "var(--text-1)" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="my-1.5 h-px" style={{ background: "var(--border-subtle)" }} />
                  <p className="px-2 py-1 font-body text-[9px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                    Source
                  </p>
                  {(["all", "kalshi", "polymarket"] as SourceFilter[]).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => { hapticLight(); setSourceFilter(src); setFiltersOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded-md font-body text-[11px] capitalize hover:bg-[var(--bg-surface)]"
                      style={{ color: sourceFilter === src ? "var(--accent)" : "var(--text-1)" }}
                    >
                      {src === "all" ? "All sources" : src}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Source tabs + connection status */}
        <div className="flex items-center gap-1.5">
          {(["all", "kalshi", "polymarket"] as SourceFilter[]).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => { hapticLight(); setSourceFilter(src); }}
              className="rounded-md px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-wider border"
              style={{
                background: sourceFilter === src ? "var(--bg-elevated)" : "transparent",
                borderColor: sourceFilter === src ? "var(--border-active)" : "var(--border-subtle)",
                color: sourceFilter === src ? "var(--text-1)" : "var(--text-3)",
              }}
            >
              {src === "all" ? "All" : src === "kalshi" ? "Kalshi" : "Poly"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
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
              <span className="font-body text-[9px] tabular-nums" style={{ color: "var(--up)" }}>
                {signalCount} live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live signals strip — compact, only when signals exist */}
      {liveSignals.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hidden">
            {liveSignals
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 5)
              .map((sig) => (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => handleSelectSignal(sig)}
                  className="shrink-0 rounded-lg border px-2.5 py-1.5 text-left hover:border-[var(--border-active)]"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                    minWidth: 160,
                    maxWidth: 200,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <SourceBadge source={sig.source} />
                    <span
                      className="font-mono text-[11px] font-bold tabular-nums"
                      style={{ color: sig.delta >= 0 ? "var(--up)" : "var(--down)" }}
                    >
                      {sig.delta >= 0 ? "+" : ""}{sig.delta.toFixed(1)}%
                    </span>
                  </div>
                  <p
                    className="mt-0.5 font-body text-[10px] leading-tight line-clamp-1"
                    style={{ color: "var(--text-2)" }}
                  >
                    {sig.question}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Market list */}
      {isError ? (
        <div className="mx-3 rounded-lg border p-6 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <p className="font-body text-sm mb-3" style={{ color: "var(--text-2)" }}>Unable to load markets.</p>
          <button
            type="button"
            onClick={() => { hapticLight(); refetch(); }}
            className="px-4 py-2 rounded-lg font-body text-xs font-medium border hover:border-[var(--border-active)]"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-1.5 px-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-card" style={{ height: 72 }} />
          ))}
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-3 pb-4 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {filtered.slice(0, shownCount).map((m, i) => {
              const isSelected = selectedMarket?.ticker === m.ticker;
              const yesPct = Math.min(100, Math.max(0, m.probability));
              const isHot = hotSignalTickers.has(m.platform_id ?? m.ticker);
              return (
                <motion.li
                  key={m.ticker}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.15) }}
                  className="cursor-pointer rounded-xl border p-3 transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{
                    background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
                    borderColor: isSelected ? "var(--accent)" : "var(--border-subtle)",
                    borderLeftWidth: isSelected ? 3 : 1,
                  }}
                  onClick={() => handleSelectMarket(m)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <SourceBadge source={m.source} />
                        {isHot && (
                          <span className="font-body text-[9px] font-bold uppercase" style={{ color: "var(--up)" }}>
                            MOVING
                          </span>
                        )}
                        {m.outcomes && m.outcomes.length > 2 && (
                          <span className="font-body text-[9px] px-1.5 py-0.5 rounded-sm border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)" }}>
                            {m.outcomes.length} options
                          </span>
                        )}
                      </div>
                      <p className="font-heading text-[12px] font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-1)" }}>
                        {m.title}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-lg font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                        {yesPct.toFixed(0)}%
                      </span>
                      <VelocityBadge v={m.velocity_1h} />
                    </div>
                  </div>
                  {m.outcomes && m.outcomes.length > 2 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.outcomes
                        .sort((a, b) => b.probability - a.probability)
                        .slice(0, 3)
                        .map((o, idx) => (
                          <span key={o.ticker ?? idx} className="font-body text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: "var(--bg-elevated)", color: "var(--text-2)" }}>
                            {o.label.length > 18 ? `${o.label.slice(0, 18)}…` : o.label} {o.probability.toFixed(0)}%
                          </span>
                        ))}
                      {m.outcomes.length > 3 && (
                        <span className="font-body text-[9px] px-1 py-0.5" style={{ color: "var(--text-3)" }}>
                          +{m.outcomes.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-body text-[10px] tabular-nums" style={{ color: "var(--text-3)" }}>
                        Vol {formatCompact(m.volume)}
                        {m.close_time ? ` · Ends ${formatCloseTime(m.close_time)}` : ""}
                      </span>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {filtered.length > shownCount && (
            <button
              type="button"
              onClick={() => { hapticLight(); setShownCount((c) => c + 12); }}
              className="w-full py-2 rounded-lg font-body text-xs font-medium border hover:border-[var(--border-active)]"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
            >
              Show more ({filtered.length - shownCount})
            </button>
          )}
          {filtered.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                No markets match your filters.
              </p>
            </div>
          )}
        </ul>
      )}
      <MarketDetailPanel />
    </div>
  );
}
