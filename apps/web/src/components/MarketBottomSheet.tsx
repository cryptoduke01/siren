"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Business", "Entertainment"];
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  All: [],
  Politics: ["trump", "biden", "election", "senate", "congress", "vote", "democrat", "republican", "president", "governor", "primaries", "electoral"],
  Crypto: ["bitcoin", "btc", "eth", "sol", "solana", "sec", "ethereum", "crypto", "token", "jpow", "fed", "rates"],
  Sports: ["world", "cup", "ufc", "nba", "nfl", "super bowl", "championship", "georgia", "purdue", "icc", "t20", "soccer", "football", "basketball"],
  Business: ["fed", "rates", "cpi", "inflation", "gdp", "earnings", "stock", "nasdaq", "market cap"],
  Entertainment: ["oscar", "grammy", "emmy", "golden globes", "award", "movie", "album"],
};
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

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "var(--green)" : "var(--red)";
  return (
    <span className="font-mono font-semibold tabular-nums text-sm" style={{ color }}>
      {dir}{abs.toFixed(1)}%/hr
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
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] flex flex-col rounded-t-xl lg:hidden"
            style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}
          >
            <div className="flex-shrink-0 p-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full flex justify-center pb-2"
                aria-label="Close"
              >
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--text-tertiary)" }} />
              </button>
              <h2 className="font-heading font-bold text-[var(--text-primary)] text-center">Markets</h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hidden mt-3 pb-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { hapticLight(); setActiveCategory(cat); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold whitespace-nowrap ${
                      activeCategory === cat ? "text-[var(--bg-base)]" : "text-[var(--text-secondary)]"
                    }`}
                    style={activeCategory === cat ? { background: "var(--accent-primary)" } : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hidden p-3 pt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-24 rounded-lg skeleton" style={{ background: "var(--bg-elevated)" }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pb-6">
                  {filteredMarkets.map((m) => (
                    <button
                      key={m.ticker}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        onSelectMarket(m);
                        onClose();
                      }}
                      className="w-full text-left rounded-lg border p-4 transition-colors"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <span className="font-mono font-semibold tabular-nums" style={{ fontSize: "1.25rem", color: "var(--accent-primary)" }}>
                          {m.probability.toFixed(0)}%
                        </span>
                        <VelocityBadge v={m.velocity_1h} />
                      </div>
                      <p className="text-sm font-heading font-bold text-[var(--text-primary)] line-clamp-2">{m.title}</p>
                      <div className="w-full h-2 rounded overflow-hidden mt-2" style={{ background: "rgba(124,58,237,0.35)" }}>
                        <motion.div
                          className="h-full rounded-l"
                          style={{ background: "var(--accent-kalshi)" }}
                          initial={false}
                          animate={{ width: `${Math.min(100, Math.max(0, m.probability))}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
