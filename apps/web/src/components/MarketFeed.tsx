"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

const INITIAL_SHOWN = 12;
const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Business", "Entertainment"];

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
  const color = v > 0 ? "var(--green)" : "var(--red)";
  return (
    <span className="font-mono font-semibold tabular-nums" style={{ fontSize: "0.95rem", color }}>
      {dir}{abs.toFixed(1)}%/hr
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

export function MarketFeed() {
  const { selectedMarket, setSelectedMarket, setDetailPanelOpen } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: markets = [], isLoading, isError } = useMarkets();

  const filteredMarkets =
    activeCategory === "All"
      ? markets
      : markets.filter((m) => {
          const kw = CATEGORY_KEYWORDS[activeCategory];
          if (!kw?.length) return true;
          const lower = `${m.title ?? ""} ${m.ticker ?? ""} ${m.subtitle ?? ""}`.toLowerCase();
          return kw.some((k) => lower.includes(k));
        });

  return (
    <div className="p-4 flex flex-col h-full lg:block">
      <div className="mb-4 flex-shrink-0 lg:block">
        <h1 className="font-heading font-bold text-base text-[var(--text-primary)] mb-1">Market feed</h1>
        <p className="text-[var(--text-secondary)] text-xs hidden lg:block">Markets from DFlow. Buy YES/NO in-app or on Kalshi.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 mb-4 scrollbar-hidden flex-shrink-0 lg:flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { hapticLight(); setActiveCategory(cat); }}
            className={`pb-2 text-xs font-heading font-semibold whitespace-nowrap transition-colors duration-[120ms] ${
              activeCategory === cat
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
            style={
              activeCategory === cat
                ? { borderBottom: "1px solid var(--accent-primary)" }
                : undefined
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--red)", background: "var(--bg-elevated)" }}>
          <p className="text-[var(--red)]">Failed to load markets. Make sure the API is running on port 4000.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-lg border p-4 skeleton"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <div className="h-4 w-16 rounded mb-3" style={{ background: "var(--border)" }} />
              <div className="h-5 w-full rounded mb-2" style={{ background: "var(--border)" }} />
              <div className="h-4 w-20 rounded mb-2" style={{ background: "var(--border)" }} />
              <div className="h-2 w-full rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-row gap-3 overflow-x-auto overflow-y-hidden lg:grid lg:grid-cols-1 lg:overflow-x-hidden lg:overflow-y-auto pr-1 min-h-0 scrollbar-hidden pb-2 lg:pb-0">
            <AnimatePresence mode="popLayout">
              {filteredMarkets.slice(0, shownCount).map((m, i) => (
                <motion.li
                  key={m.ticker}
                  layout
                  initial={{ opacity: 0, transform: "translateY(4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2), ease: "easeOut" }}
                  className="rounded-lg border overflow-hidden cursor-pointer transition-all duration-[120ms] ease-in-out hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: selectedMarket?.ticker === m.ticker ? "var(--border-active)" : "var(--border)",
                    minWidth: "240px",
                    flexShrink: 0,
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
                  }}
                >
                  <div className="p-4">
                    {/* Hero: probability + velocity */}
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                      <span className="font-mono font-semibold tabular-nums" style={{ fontSize: "1.75rem", color: "var(--accent-primary)" }}>
                        {m.probability.toFixed(0)}%
                      </span>
                      <VelocityBadge v={m.velocity_1h} />
                    </div>
                    <p className="text-sm font-heading font-bold text-[var(--text-primary)] line-clamp-2 mb-3">{m.title}</p>
                    {/* YES/NO bar — green YES, purple NO */}
                    <div className="w-full h-2.5 rounded overflow-hidden mb-2 flex" style={{ background: "rgba(124,58,237,0.35)" }}>
                      <motion.div
                        className="h-full rounded-l shrink-0"
                        style={{ background: "var(--accent-kalshi)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, m.probability))}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums">
                      Vol: {m.volume?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {filteredMarkets.length > shownCount && (
            <button
              type="button"
              onClick={() => { hapticLight(); setShownCount((c) => c + 8); }}
              className="mt-4 w-full py-2.5 rounded-md border text-sm font-heading font-semibold transition-all duration-[120ms] text-[var(--text-primary)] hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
            >
              Show more ({filteredMarkets.length - shownCount} left)
            </button>
          )}
        </>
      )}
      <MarketDetailPanel />
    </div>
  );
}
