"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { MarketFeed } from "@/components/MarketFeed";
import { TokenSurface } from "@/components/TokenSurface";
import { MobileStickyMarket } from "@/components/MobileStickyMarket";
import { MarketBottomSheet } from "@/components/MarketBottomSheet";
import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import type { MarketWithVelocity } from "@siren/shared";

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

export default function Home() {
  const { data: markets = [], isLoading } = useMarkets();
  const { setSelectedMarket } = useSirenStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState("All");

  const handleSelectMarket = (m: MarketWithVelocity) => {
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

  return (
    <div className="app-shell">
      <header className="topbar" style={{ gridColumn: "1 / -1", gridRow: 1 }}>
        <TopBar />
      </header>
      <aside className="left-panel hidden lg:block">
        <MarketFeed />
      </aside>
      <main className="main-panel">
        <div className="lg:hidden">
          <MobileStickyMarket onOpenMarkets={() => setSheetOpen(true)} />
        </div>
        <TokenSurface />
      </main>
      <MarketBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        markets={markets}
        isLoading={isLoading}
        activeCategory={mobileCategory}
        setActiveCategory={setMobileCategory}
        onSelectMarket={handleSelectMarket}
      />
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-20 font-mono text-[11px] px-4 py-2 rounded-full transition-all duration-[120ms] ease"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-1)",
        }}
      >
        MARKETS
      </button>
    </div>
  );
}
