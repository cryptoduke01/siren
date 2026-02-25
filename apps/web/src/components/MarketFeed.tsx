"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INITIAL_SHOWN = 12;
const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Business", "Entertainment"];

function fetchMarkets(): Promise<MarketWithVelocity[]> {
  return fetch(`${API_URL}/api/markets`, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`Markets API error: ${r.status}`);
      return r.json();
    })
    .then((j) => j.data ?? []);
}

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "text-siren-kalshi" : "text-red-400";
  return <span className={`text-xs font-data ${color}`}>{dir}{abs.toFixed(1)}%/hr</span>;
}

const MARKET_KEYWORDS = ["trump", "fed", "rates", "cpi", "inflation", "sec", "bitcoin", "btc", "election", "world", "cup", "georgia", "purdue", "uae", "icc", "t20"];

function extractKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  return MARKET_KEYWORDS.filter((kw) => lower.includes(kw)).slice(0, 3);
}

export function MarketFeed() {
  const { selectedMarket, setSelectedMarket } = useSirenStore();
  const [shownCount, setShownCount] = useState(INITIAL_SHOWN);
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: markets = [], isLoading, isError } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    refetchInterval: 60_000,
    retry: 2,
  });

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="rounded-2xl bg-siren-primary/15 dark:bg-siren-primary/10 border border-siren-primary/30 p-5 mb-6">
        <h1 className="font-heading font-bold text-lg text-siren-text-primary mb-1">Trending predictions</h1>
        <p className="text-siren-text-secondary text-sm">Markets from DFlow. Trade on Kalshi.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { hapticLight(); setActiveCategory(cat); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat ? "bg-siren-primary text-white dark:text-siren-bg" : "bg-siren-surface dark:bg-white/5 border border-siren-border text-siren-text-secondary hover:text-siren-text-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
          <p>Failed to load markets. Make sure the API is running on port 4000.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-siren-border bg-siren-surface dark:bg-white/5 p-4 space-y-3">
              <div className="skeleton h-4 w-16 rounded-lg" />
              <div className="skeleton h-5 w-full rounded" />
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 min-h-0">
            <AnimatePresence mode="popLayout">
              {markets.slice(0, shownCount).map((m, i) => (
                <motion.li
                  key={m.ticker}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
                  className={`rounded-2xl border overflow-hidden cursor-pointer transition-all bg-siren-surface dark:bg-white/5 hover:border-siren-primary/40 active:scale-[0.99] ${
                    selectedMarket?.ticker === m.ticker ? "border-siren-primary ring-2 ring-siren-primary/30" : "border-siren-border"
                  }`}
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
                      subtitle: m.subtitle,
                      keywords: extractKeywords(m.title),
                    });
                  }}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-siren-kalshi/20 text-siren-kalshi">Market</span>
                      <VelocityBadge v={m.velocity_1h} />
                    </div>
                    <p className="text-sm font-medium text-siren-text-primary line-clamp-2 mb-3">{m.title}</p>
                    <div className="flex justify-between items-center text-xs text-siren-text-secondary mb-2">
                      <span className="font-data text-siren-primary font-medium">{m.probability.toFixed(0)}% YES</span>
                      <span>Vol: {m.volume?.toLocaleString() ?? "—"}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-siren-border overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-siren-kalshi"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, m.probability))}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {markets.length > shownCount && (
            <button
              type="button"
              onClick={() => { hapticLight(); setShownCount((c) => c + 8); }}
              className="mt-4 w-full py-2.5 rounded-xl border border-siren-border text-siren-text-secondary hover:text-siren-primary hover:border-siren-primary/40 text-sm font-medium transition-colors"
            >
              Show more ({markets.length - shownCount} left)
            </button>
          )}
        </>
      )}
      <MarketDetailPanel />
    </div>
  );
}
