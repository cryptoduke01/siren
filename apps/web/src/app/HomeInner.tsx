 "use client";

 import { useState, useEffect, useRef } from "react";
 import { useSearchParams } from "next/navigation";
 import { MarketFeed } from "@/components/MarketFeed";
import { TokenSurface } from "@/components/TokenSurface";
import { ActivityFeed } from "@/components/ActivityFeed";
import { MobileStickyMarket } from "@/components/MobileStickyMarket";
 import { MarketBottomSheet } from "@/components/MarketBottomSheet";
 import { TokensForMarketSheet } from "@/components/TokensForMarketSheet";
 import { useMarkets } from "@/hooks/useMarkets";
 import { useIsMobileLg } from "@/hooks/useIsMobile";
 import { useSirenStore } from "@/store/useSirenStore";
 import type { MarketWithVelocity } from "@siren/shared";

 const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

 export function HomeInner() {
   const searchParams = useSearchParams();
   const { data: markets = [], isLoading } = useMarkets();
   const { setSelectedMarket, setSelectedToken, setBuyPanelOpen } = useSirenStore();
   const [sheetOpen, setSheetOpen] = useState(false);
   const [tokensSheetOpen, setTokensSheetOpen] = useState(false);
   const [mobileCategory, setMobileCategory] = useState("All");
   const appliedShareRef = useRef<{ market?: string; token?: string }>({});
   const isMobileLg = useIsMobileLg();

   useEffect(() => {
     const marketTicker = searchParams.get("market");
     if (marketTicker && markets.length > 0 && appliedShareRef.current.market !== marketTicker) {
       const m = markets.find((x) => x.ticker === marketTicker);
       if (m) {
         appliedShareRef.current.market = marketTicker;
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
       }
     }
   }, [searchParams, markets, setSelectedMarket]);

   useEffect(() => {
     const tokenMint = searchParams.get("token");
     if (!tokenMint || appliedShareRef.current.token === tokenMint) return;
     appliedShareRef.current.token = tokenMint;
     fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(tokenMint)}`, { credentials: "omit" })
       .then((r) => r.json())
       .then((j) => {
         const d = j.data;
         if (d) {
           setSelectedToken({
             mint: tokenMint,
             name: d.name ?? "Unknown",
             symbol: d.symbol ?? "???",
             price: d.priceUsd,
             volume24h: undefined,
             ctMentions: undefined,
           });
           setBuyPanelOpen(true);
         }
       })
       .catch(() => {});
   }, [searchParams, setSelectedToken, setBuyPanelOpen]);

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
       <aside className="left-panel">
         <MarketFeed
           onAfterSelectMarket={isMobileLg ? () => setTokensSheetOpen(true) : undefined}
         />
       </aside>
      <main className="main-panel hidden lg:block">
        <div className="lg:hidden">
          <MobileStickyMarket onOpenMarkets={() => setSheetOpen(true)} />
        </div>
        <ActivityFeed />
        <TokenSurface />
       </main>
       <TokensForMarketSheet isOpen={tokensSheetOpen} onClose={() => setTokensSheetOpen(false)} />
       <MarketBottomSheet
         isOpen={sheetOpen}
         onClose={() => setSheetOpen(false)}
         markets={markets}
         isLoading={isLoading}
         activeCategory={mobileCategory}
         setActiveCategory={setMobileCategory}
         onSelectMarket={(m) => {
           handleSelectMarket(m);
           setTokensSheetOpen(true);
         }}
       />
     </div>
   );
 }

