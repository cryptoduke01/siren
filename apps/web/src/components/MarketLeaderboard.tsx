"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import type { MarketWithVelocity } from "@siren/shared";

const MARKET_KEYWORDS = ["trump", "fed", "rates", "cpi", "inflation", "sec", "bitcoin", "btc", "election"];
const STOP_WORDS = new Set(["will", "the", "and", "for", "are", "but", "not"]);

function extractKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  return MARKET_KEYWORDS.filter((kw) => lower.includes(kw)).slice(0, 4);
}

export function MarketLeaderboard() {
  const { data: markets = [] } = useMarkets();
  const { setSelectedMarket } = useSirenStore();

  const byVolume = [...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5);
  const byVelocity = [...markets].sort((a, b) => Math.abs(b.velocity_1h) - Math.abs(a.velocity_1h)).slice(0, 5);

  const select = (m: MarketWithVelocity) => {
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
  };

  const [collapsed, setCollapsed] = useState(false);

  if (markets.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-t px-4 py-2" style={{ borderColor: "var(--border-subtle)" }}>
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setCollapsed((c) => !c);
        }}
        className="w-full flex items-center justify-between gap-2 py-2 text-left"
      >
        <h3 className="font-heading font-semibold text-[10px]" style={{ letterSpacing: "0.1em", color: "var(--text-3)" }}>
          TOP MARKETS
        </h3>
        {collapsed ? (
          <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} aria-hidden />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} aria-hidden />
        )}
      </button>
      {!collapsed && (
      <div className="grid grid-cols-2 gap-2 pb-2">
        <div>
          <p className="font-body text-[10px] mb-1" style={{ color: "var(--text-3)" }}>By volume</p>
          {byVolume.map((m) => (
            <button
              key={m.ticker}
              type="button"
              onClick={() => select(m)}
              className="w-full text-left py-1 rounded-[4px] px-2 hover:bg-[var(--bg-hover)] transition-colors duration-[120ms]"
            >
              <p className="font-heading text-[11px] truncate" style={{ color: "var(--text-1)" }}>{m.title.slice(0, 20)}…</p>
              <p className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>{m.probability.toFixed(0)}%</p>
            </button>
          ))}
        </div>
        <div>
          <p className="font-body text-[10px] mb-1" style={{ color: "var(--text-3)" }}>By velocity</p>
          {byVelocity.map((m) => (
            <button
              key={m.ticker}
              type="button"
              onClick={() => select(m)}
              className="w-full text-left py-1 rounded-[4px] px-2 hover:bg-[var(--bg-hover)] transition-colors duration-[120ms]"
            >
              <p className="font-heading text-[11px] truncate" style={{ color: "var(--text-1)" }}>{m.title.slice(0, 20)}…</p>
              <p className="font-mono text-[10px]" style={{ color: m.velocity_1h > 0 ? "var(--up)" : "var(--down)" }}>
                {m.velocity_1h > 0 ? "+" : ""}{m.velocity_1h.toFixed(1)}%/hr
              </p>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
