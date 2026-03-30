"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/store/useToastStore";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useSignals } from "@/hooks/useSignals";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { ChevronDown, RefreshCw } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity, PredictionSignal } from "@siren/shared";
import { toSelectedMarket } from "@/lib/marketSelection";

const INITIAL_SHOWN = 16;
const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Business", "Entertainment"];
const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;

type SortMode = "default" | "volume" | "open_interest" | "ending_soon" | "hot";
type SignalFilter = "all" | "kalshi" | "polymarket";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  All: [],
  Politics: ["trump", "biden", "election", "senate", "congress", "vote", "democrat", "republican", "president", "governor", "primaries", "electoral"],
  Crypto: ["bitcoin", "btc", "eth", "sol", "solana", "sec", "ethereum", "crypto", "token", "jpow", "fed", "rates"],
  Sports: ["world", "cup", "ufc", "nba", "nfl", "super bowl", "championship", "georgia", "purdue", "icc", "t20", "soccer", "football", "basketball"],
  Business: ["fed", "rates", "cpi", "inflation", "gdp", "earnings", "stock", "nasdaq", "market cap"],
  Entertainment: ["oscar", "grammy", "emmy", "golden globes", "award", "movie", "album"],
};

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "var(--up)" : "var(--down)";
  const arrow = v > 0 ? "▲" : "▼";
  return (
    <span className="font-body text-[11px] tabular-nums" style={{ color }}>
      {arrow} {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

function marketAvatar(title: string): string {
  const letter = (title?.trim()?.[0] || "M").toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(letter)}&background=0b1220&color=e5e7eb&size=64`;
}

function formatCompactStat(value?: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignalTimestamp(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "";
  const deltaMinutes = Math.max(0, Math.round((Date.now() - parsed) / 60_000));
  if (deltaMinutes < 1) return "just now";
  if (deltaMinutes === 1) return "1 min ago";
  if (deltaMinutes < 60) return `${deltaMinutes} mins ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

function formatSignalVolume(volume: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(volume);
}

function SourceBadge({ source }: { source: PredictionSignal["source"] }) {
  const badge =
    source === "kalshi"
      ? { label: "KALSHI", background: "#00B2FF" }
      : { label: "POLYMARKET", background: "#6B3FDB" };

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ background: badge.background, color: "#FFFFFF" }}
    >
      {badge.label}
    </span>
  );
}

export function MarketFeed({ onAfterSelectMarket }: { onAfterSelectMarket?: (m: MarketWithVelocity) => void } = {}) {
  const { selectedMarket, selectedSignal, setSelectedMarket, setSelectedSignal } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [activeCategory, setActiveCategory] = useState("All");
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");

  const addToast = useToastStore((s) => s.addToast);
  const { data: markets = [], isLoading, isError, error, refetch } = useMarkets();
  const {
    signals,
    status: signalStatus,
    isError: isSignalError,
    error: signalError,
    refetch: refetchSignals,
  } = useSignals();

  useEffect(() => {
    if (isError && error) addToast("Unable to load markets. Please try again in a moment.", "error");
  }, [isError, error, addToast]);

  useEffect(() => {
    if (isSignalError && signalError) {
      addToast("Unable to load live signals. Market browsing is still available.", "error");
    }
  }, [isSignalError, signalError, addToast]);

  const liveSignals = useMemo(
    () => signals.filter((signal) => Date.now() - Date.parse(signal.timestamp) <= LIVE_SIGNAL_WINDOW_MS),
    [signals]
  );
  const filteredSignals = useMemo(() => {
    const sourceFiltered =
      signalFilter === "all" ? liveSignals : liveSignals.filter((signal) => signal.source === signalFilter);
    return [...sourceFiltered].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [liveSignals, signalFilter]);

  const categoryFiltered =
    activeCategory === "All"
      ? markets
      : markets.filter((m) => {
          const kw = CATEGORY_KEYWORDS[activeCategory];
          if (!kw?.length) return true;
          const lower = `${m.title ?? ""} ${m.ticker ?? ""} ${m.subtitle ?? ""}`.toLowerCase();
          return kw.some((k) => lower.includes(k));
        });

  const filteredMarkets = useMemo(() => {
    if (!marketSearchQuery.trim()) return categoryFiltered;
    const q = marketSearchQuery.trim().toLowerCase();
    const normalized = q.replace(/^https?:\/\//, "");
    return categoryFiltered.filter(
      (m) =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.ticker && m.ticker.toLowerCase().includes(q)) ||
        (m.source && m.source.toLowerCase().includes(q)) ||
        (m.subtitle && m.subtitle.toLowerCase().includes(q)) ||
        (m.event_ticker && m.event_ticker.toLowerCase().includes(q)) ||
        ((m.market_url || m.kalshi_url) &&
          ((m.market_url || m.kalshi_url)!.toLowerCase().includes(q) ||
            (m.market_url || m.kalshi_url)!.toLowerCase().includes(normalized)))
    );
  }, [categoryFiltered, marketSearchQuery]);

  const sortedMarkets = useMemo(() => {
    const base = [...filteredMarkets];
    switch (sortMode) {
      case "volume":
        return base.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      case "open_interest":
        return base.sort((a, b) => (b.open_interest ?? 0) - (a.open_interest ?? 0));
      case "hot":
        return base.sort((a, b) => Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h));
      case "ending_soon":
        return base.sort((a, b) => {
          const aClose = a.close_time ?? Number.POSITIVE_INFINITY;
          const bClose = b.close_time ?? Number.POSITIVE_INFINITY;
          if (aClose === bClose) return 0;
          return aClose - bClose;
        });
      case "default":
      default:
        return base;
    }
  }, [filteredMarkets, sortMode]);

  const handleSelectSignal = (signal: PredictionSignal) => {
    hapticLight();
    const linkedMarket = markets.find(
      (market) =>
        market.source === signal.source &&
        (market.platform_id === signal.marketId || market.ticker === signal.marketId)
    );
    if (linkedMarket) {
      setSelectedMarket(toSelectedMarket(linkedMarket));
      onAfterSelectMarket?.(linkedMarket);
      return;
    }
    setSelectedSignal(signal);
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden min-h-0"
      style={{
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex-shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {signalStatus.map((status) => (
              <div
                key={status.source}
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em]"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface)",
                  color: "var(--text-2)",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: status.connected ? "var(--up)" : "var(--down)" }}
                />
                {status.source === "kalshi" ? "Kalshi" : "Polymarket"}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              refetchSignals();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 font-body text-[11px]"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-hidden">
          {[
            { id: "all", label: "ALL" },
            { id: "kalshi", label: "KALSHI" },
            { id: "polymarket", label: "POLYMARKET" },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                hapticLight();
                setSignalFilter(filter.id as SignalFilter);
              }}
              className="rounded-[8px] border px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                background: signalFilter === filter.id ? "var(--bg-elevated)" : "transparent",
                borderColor: signalFilter === filter.id ? "var(--border-active)" : "var(--border-subtle)",
                color: signalFilter === filter.id ? "var(--text-1)" : "var(--text-3)",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1 scrollbar-hidden">
          {filteredSignals.length > 0 ? (
            filteredSignals.map((signal) => {
              const isSelected =
                selectedSignal?.id === signal.id ||
                (selectedMarket?.source === signal.source &&
                  (selectedMarket.platform_id === signal.marketId || selectedMarket.ticker === signal.marketId));
              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => handleSelectSignal(signal)}
                  className="w-full rounded-[14px] border p-3 text-left transition-all duration-[120ms] ease hover:bg-[var(--bg-elevated)]"
                  style={{
                    background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
                    borderColor: isSelected ? "var(--border-active)" : "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SourceBadge source={signal.source} />
                        <span className="font-body text-[10px]" style={{ color: "var(--text-3)" }}>
                          {formatSignalTimestamp(signal.timestamp)}
                        </span>
                      </div>
                      <p className="mt-2 font-heading text-[13px] font-semibold leading-tight" style={{ color: "var(--text-1)" }}>
                        {signal.question}
                      </p>
                      <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                        {signal.matchedTokens.length} matched tokens · Vol {formatSignalVolume(signal.volume)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="font-mono text-sm font-semibold tabular-nums"
                        style={{ color: signal.delta >= 0 ? "var(--up)" : "var(--down)" }}
                      >
                        {signal.delta >= 0 ? "+" : ""}
                        {signal.delta.toFixed(1)}%
                      </p>
                      <p className="mt-1 font-body text-[11px]" style={{ color: "var(--text-2)" }}>
                        YES {signal.currentProb.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div
              className="rounded-[14px] border border-dashed p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <p className="font-body text-[11px]" style={{ color: "var(--text-2)" }}>
                No big live moves yet. When Kalshi or Polymarket starts moving, the strongest signals will show up here.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <button
          type="button"
          className="w-full h-8 rounded-[8px] border px-3 text-[11px] font-body flex items-center justify-between"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
        >
          Market Filters
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-shrink-0 px-4 pb-2">
        <input
          type="text"
          placeholder="Search markets..."
          value={marketSearchQuery}
          onChange={(e) => setMarketSearchQuery(e.target.value)}
          className="w-full font-body text-[11px] h-8 px-3 rounded-[6px] border transition-all duration-[120ms] ease focus:border-[var(--border-active)] focus:outline-none focus:ring-0"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-1)",
          }}
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden flex-shrink-0 px-4 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { hapticLight(); setActiveCategory(cat); }}
            className="font-body text-[10px] uppercase whitespace-nowrap rounded-[6px] px-2 py-1 border"
            style={{
              color: activeCategory === cat ? "var(--text-1)" : "var(--text-3)",
              background: activeCategory === cat ? "var(--bg-elevated)" : "transparent",
              borderColor: activeCategory === cat ? "var(--border-active)" : "var(--border-subtle)",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      {isError ? (
        <div
          className="mx-2 rounded-[6px] border p-6 text-center flex flex-col items-center gap-3"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
            Unable to load markets at the moment.
          </p>
          <button
            type="button"
            onClick={() => { hapticLight(); refetch(); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] font-body font-medium text-sm border transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-1)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-[6px] px-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card" style={{ height: 120 }} />
          ))}
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hidden px-2 pb-4">
          <AnimatePresence mode="popLayout">
            {sortedMarkets.slice(0, shownCount).map((m, i) => {
              const isSelected = selectedMarket?.ticker === m.ticker;
              const yesPct = Math.min(100, Math.max(0, m.probability));
              const isHot = Math.abs(m.velocity_1h) >= 1;
              const signalStrength = Math.min(100, Math.max(0, 50 + m.velocity_1h * 10));
              const signalColor = m.velocity_1h > 0 ? "var(--up)" : m.velocity_1h < 0 ? "var(--down)" : "var(--border-subtle)";
              return (
                <motion.li
                  key={m.ticker}
                  layout
                  initial={{ opacity: 0, transform: "translateY(6px)" }}
                  animate={{
                    opacity: 1,
                    transform: "translateY(0)",
                    boxShadow: isHot ? "0 0 0 1px color-mix(in srgb, var(--up) 20%, transparent)" : undefined,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.2), ease: "easeOut" }}
                  className={`cursor-pointer rounded-[14px] p-3 mb-2 transition-all duration-[120ms] ease hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] relative overflow-hidden ${isHot ? "pulse-hot" : ""}`}
                  style={{
                    background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "1px solid var(--border-subtle)",
                  }}
                  onClick={() => {
                    hapticLight();
                    setSelectedMarket(toSelectedMarket(m));
                    onAfterSelectMarket?.(m);
                  }}
                >
                  <div className="mb-2 flex items-center gap-2 min-w-0">
                    <img src={marketAvatar(m.title)} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
                    <SourceBadge source={m.source} />
                    <p
                      className="min-w-0 flex-1 font-heading text-[13px] font-bold leading-tight line-clamp-1"
                      style={{ color: "var(--text-1)" }}
                    >
                      {m.title}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span
                      className="font-body text-[20px] font-semibold tabular-nums"
                      style={{ color: "var(--accent)" }}
                    >
                      {yesPct.toFixed(0)}%
                    </span>
                    <VelocityBadge v={m.velocity_1h} />
                  </div>
                  <div
                    className="w-full h-[2px] rounded-full mb-2 flex overflow-hidden"
                    style={{ background: "var(--border-subtle)" }}
                  >
                    <div
                      className="h-full rounded-full shrink-0 transition-all duration-300"
                      style={{
                        width: `${Math.max(4, signalStrength)}%`,
                        background: signalColor,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body text-[10px]" style={{ color: "var(--text-3)" }}>
                      24h {formatCompactStat(m.volume_24h)} · OI {formatCompactStat(m.open_interest)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        setSelectedMarket(toSelectedMarket(m));
                        onAfterSelectMarket?.(m);
                      }}
                      className="font-body text-[10px] font-medium hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {m.source === "polymarket" ? "Open Poly + tokens" : "Open market + tokens"}
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {filteredMarkets.length > shownCount && (
            <button
              type="button"
              onClick={() => { hapticLight(); setShownCount((c) => c + 8); }}
              className="w-full py-2.5 rounded-[6px] font-body font-medium text-xs border transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-1)", marginTop: 4 }}
            >
              Show more ({filteredMarkets.length - shownCount} left)
            </button>
          )}
        </ul>
      )}
      <MarketDetailPanel />
    </div>
  );
}
