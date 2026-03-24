"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/store/useToastStore";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { MarketLeaderboard } from "./MarketLeaderboard";
import { MiniSparkline } from "./MiniSparkline";
import { RefreshCw } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

const INITIAL_SHOWN = 12;
const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Business", "Entertainment"];

type SortMode = "default" | "volume" | "open_interest" | "ending_soon" | "hot";

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
    <span className="font-mono text-[11px] tabular-nums" style={{ color }}>
      {arrow} {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

const MARKET_KEYWORDS = ["trump", "fed", "rates", "cpi", "inflation", "sec", "bitcoin", "btc", "election", "world", "cup", "georgia", "purdue", "uae", "icc", "t20", "sol", "eth", "jpow", "pepe", "bonk"];
const STOP_WORDS = new Set(["will", "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "any", "did", "let", "put", "say", "she", "too", "use", "from", "than", "that", "this", "with", "what", "when", "where", "which"]);

function extractKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const fromKnown = MARKET_KEYWORDS.filter((kw) => lower.includes(kw)).slice(0, 2);
  const words = lower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const seen = new Set(fromKnown);
  const out = [...fromKnown];
  for (const w of words) {
    if (!seen.has(w) && out.length < 4) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

export function MarketFeed({ onAfterSelectMarket }: { onAfterSelectMarket?: (m: MarketWithVelocity) => void } = {}) {
  const { selectedMarket, setSelectedMarket, setDetailPanelOpen } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [activeCategory, setActiveCategory] = useState("All");
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("hot");

  const addToast = useToastStore((s) => s.addToast);
  const { data: markets = [], isLoading, isError, error, refetch } = useMarkets();

  useEffect(() => {
    if (isError && error) addToast("Unable to load markets. Please try again in a moment.", "error");
  }, [isError, error, addToast]);

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
    return categoryFiltered.filter(
      (m) =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.ticker && m.ticker.toLowerCase().includes(q)) ||
        (m.subtitle && m.subtitle.toLowerCase().includes(q))
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

  return (
    <div
      className="h-full flex flex-col overflow-hidden min-h-0"
      style={{
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <h2
          className="font-heading font-semibold text-[10px]"
          style={{ letterSpacing: "0.15em", color: "var(--text-3)" }}
        >
          MARKETS
        </h2>
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
      <div className="flex gap-2 overflow-x-auto scrollbar-hidden flex-shrink-0 px-4 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { hapticLight(); setActiveCategory(cat); }}
            className="font-body font-medium text-[11px] uppercase whitespace-nowrap rounded-[4px] px-2.5 py-1.5 transition-all duration-[120ms] ease"
            style={{
              color: activeCategory === cat ? "var(--text-1)" : "var(--text-3)",
              background: activeCategory === cat ? "var(--bg-elevated)" : "transparent",
              border: activeCategory === cat ? "1px solid var(--border-active)" : "1px solid transparent",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hidden flex-shrink-0 px-4 pb-3">
        {[
          { id: "default", label: "Top" },
          { id: "volume", label: "High volume" },
          { id: "open_interest", label: "High OI" },
          { id: "ending_soon", label: "Ending soon" },
          { id: "hot", label: "Moving fast" },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              hapticLight();
              setSortMode(s.id as SortMode);
            }}
            className="font-body text-[11px] whitespace-nowrap rounded-[4px] px-2.5 py-1.5 transition-all duration-[120ms] ease border"
            style={{
              background: sortMode === (s.id as SortMode) ? "var(--bg-elevated)" : "transparent",
              borderColor: sortMode === (s.id as SortMode) ? "var(--border-active)" : "var(--border-subtle)",
              color: sortMode === (s.id as SortMode) ? "var(--text-1)" : "var(--text-3)",
            }}
          >
            {s.label}
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
                  className={`cursor-pointer rounded-[8px] p-3 mb-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] relative overflow-hidden ${isHot ? "pulse-hot" : ""}`}
                  style={{
                    background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "1px solid var(--border-subtle)",
                  }}
                  onClick={() => {
                    hapticLight();
                    setSelectedMarket({
                      ticker: m.ticker,
                      title: m.title,
                      probability: m.probability,
                      velocity_1h: m.velocity_1h,
                      volume: m.volume,
                      open_interest: m.open_interest,
                      event_ticker: m.event_ticker,
                      series_ticker: m.series_ticker,
                      subtitle: m.subtitle,
                      keywords: extractKeywords(m.title),
                      yes_mint: m.yes_mint,
                      no_mint: m.no_mint,
                      kalshi_url: m.kalshi_url,
                    });
                    onAfterSelectMarket?.(m);
                  }}
                >
                  <p
                    className="font-heading font-bold text-[13px] leading-tight line-clamp-1 mb-2"
                    style={{ color: "var(--text-1)" }}
                  >
                    {m.title}
                  </p>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span
                      className="font-mono text-[20px] font-semibold tabular-nums"
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
                      Vol {m.volume?.toLocaleString() ?? "—"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        setSelectedMarket({
                          ticker: m.ticker,
                          title: m.title,
                          probability: m.probability,
                          velocity_1h: m.velocity_1h,
                          volume: m.volume,
                          open_interest: m.open_interest,
                          event_ticker: m.event_ticker,
                          series_ticker: m.series_ticker,
                          subtitle: m.subtitle,
                          keywords: extractKeywords(m.title),
                          yes_mint: m.yes_mint,
                          no_mint: m.no_mint,
                          kalshi_url: m.kalshi_url,
                        });
                        onAfterSelectMarket?.(m);
                      }}
                      className="font-body text-[10px] font-medium hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      View tokens →
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
      <MarketLeaderboard />
      <MarketDetailPanel />
    </div>
  );
}
