"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import { StarButton } from "./StarButton";
import type { MarketWithVelocity } from "@siren/shared";

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
  const color = v > 0 ? "var(--up)" : "var(--down)";
  const arrow = v > 0 ? "▲" : "▼";
  return (
    <span className="font-mono text-[11px] tabular-nums" style={{ color }}>
      {arrow} {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

export function MarketBottomSheet({
  isOpen,
  onClose,
  markets,
  isLoading,
  activeCategory,
  setActiveCategory,
  onSelectMarket,
}: {
  isOpen: boolean;
  onClose: () => void;
  markets: MarketWithVelocity[];
  isLoading: boolean;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  onSelectMarket: (m: MarketWithVelocity) => void;
}) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] flex flex-col lg:hidden"
            style={{
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex-shrink-0 p-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full flex justify-center pb-2"
                aria-label="Close"
              >
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: "var(--text-3)" }}
                />
              </button>
              <h2
                className="font-heading font-semibold text-center text-sm"
                style={{ color: "var(--text-1)" }}
              >
                MARKETS
              </h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hidden mt-3 pb-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { hapticLight(); setActiveCategory(cat); }}
                    className="font-body font-medium text-[11px] uppercase whitespace-nowrap rounded-[4px] px-2.5 py-1.5 transition-all duration-[120ms] ease"
                    style={{
                      color: activeCategory === cat ? "var(--text-1)" : "var(--text-3)",
                      background: activeCategory === cat ? "var(--bg-elevated)" : "transparent",
                      border: activeCategory === cat ? "1px solid var(--border-active)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hidden p-3 pt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton-card" style={{ height: 100 }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pb-6">
                  {filteredMarkets.map((m) => {
                    const yesPct = Math.min(100, Math.max(0, m.probability));
                    return (
                      <button
                        key={m.ticker}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          onSelectMarket(m);
                          onClose();
                        }}
                        className="w-full text-left rounded-[6px] border p-3 transition-all duration-[120ms] ease hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] relative"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--border-subtle)",
                        }}
                      >
                        <div className="absolute top-2 right-2">
                          <StarButton type="market" id={m.ticker} />
                        </div>
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <span
                            className="font-mono text-lg font-normal tabular-nums"
                            style={{ color: "var(--accent)" }}
                          >
                            {m.probability.toFixed(0)}%
                          </span>
                          <VelocityBadge v={m.velocity_1h} />
                        </div>
                        <p
                          className="font-heading font-semibold text-[13px] line-clamp-2"
                          style={{ color: "var(--text-1)" }}
                        >
                          {m.title}
                        </p>
                        <div
                          className="w-full h-[3px] rounded-[2px] mt-2 flex overflow-hidden"
                          style={{ background: "var(--border-subtle)" }}
                        >
                          <div
                            className="h-full rounded-l-[2px] shrink-0"
                            style={{
                              width: `${yesPct}%`,
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
