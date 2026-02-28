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
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
      <TopBar />
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Desktop: left panel with market feed */}
        <aside
          className="hidden lg:flex lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] flex-shrink-0 overflow-y-auto scrollbar-hidden border-r"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <MarketFeed />
        </aside>

        {/* Main content: tokens. Mobile = full-width feed; Desktop = right panel */}
        <section
          className="flex-1 overflow-y-auto p-4 md:p-6 min-h-[50vh] lg:min-h-0 scrollbar-hidden flex flex-col"
          style={{ background: "var(--bg-base)" }}
        >
          {/* Mobile: sticky market card at top */}
          <MobileStickyMarket onOpenMarkets={() => setSheetOpen(true)} />

          <TokenSurface />
        </section>
      </main>

      {/* Mobile: bottom sheet for market list */}
      <MarketBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        markets={markets}
        isLoading={isLoading}
        activeCategory={mobileCategory}
        setActiveCategory={setMobileCategory}
        onSelectMarket={handleSelectMarket}
      />
    </div>
  );
}
