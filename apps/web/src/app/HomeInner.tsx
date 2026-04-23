"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MarketFeed } from "@/components/MarketFeed";
import { MarketExecutionSurface } from "@/components/MarketExecutionSurface";
import { TerminalRightPanel } from "@/components/TerminalRightPanel";
import { MobileStickyMarket } from "@/components/MobileStickyMarket";
import { MarketBottomSheet } from "@/components/MarketBottomSheet";
import { TokensForMarketSheet } from "@/components/TokensForMarketSheet";
import { useMarkets } from "@/hooks/useMarkets";
import { useIsMobileLg } from "@/hooks/useIsMobile";
import { useSirenStore } from "@/store/useSirenStore";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import type { MarketWithVelocity } from "@siren/shared";
import { toSelectedMarket } from "@/lib/marketSelection";
const SIDEBAR_MIN = 340;
const SIDEBAR_MAX = 620;
const SIDEBAR_DEFAULT = 400;

export function HomeInner() {
  const { isReady } = useSirenWallet();
  const searchParams = useSearchParams();
  const { data: markets = [], isLoading } = useMarkets();
  const { setSelectedMarket, setBuyPanelOpen } = useSirenStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tokensSheetOpen, setTokensSheetOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState("all");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isResizing = useRef(false);
  const appliedShareRef = useRef<{ market?: string }>({});
  const isMobileLg = useIsMobileLg();

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
    setSidebarWidth(w);
  }, []);
  const stopResize = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
  }, [handleResize]);
  const startResize = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  }, [handleResize, stopResize]);

  useEffect(() => {
    const marketTicker = searchParams.get("market");
    if (marketTicker && markets.length > 0 && appliedShareRef.current.market !== marketTicker) {
      const m = markets.find((x) => x.ticker === marketTicker);
      if (m) {
        appliedShareRef.current.market = marketTicker;
        setSelectedMarket(toSelectedMarket(m));
      }
    }
  }, [searchParams, markets, setSelectedMarket]);

  const handleSelectMarket = (m: MarketWithVelocity) => {
    setSelectedMarket(toSelectedMarket(m));
  };

  if (!isReady) {
    return (
      <div className="app-shell">
        <aside className="left-panel">
          <div className="h-full p-4">
            <div className="h-full rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
              <div className="h-11 rounded-2xl skeleton-card" style={{ height: 44 }} />
              <div className="mt-4 grid gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="skeleton-card" style={{ height: 180 }} />
                ))}
              </div>
            </div>
          </div>
        </aside>
        <main className="main-panel hidden lg:block min-w-0">
          <div className="h-full rounded-[20px] border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <div className="h-14 rounded-2xl skeleton-card" style={{ height: 56 }} />
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.8fr_1fr]">
              <div className="skeleton-card" style={{ height: 320 }} />
              <div className="skeleton-card" style={{ height: 320 }} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="skeleton-card" style={{ height: 240 }} />
              <div className="skeleton-card" style={{ height: 240 }} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside
        className="left-panel"
        style={!isMobileLg ? { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth, padding: 8 } : undefined}
      >
        <div
          className="h-full rounded-[20px] border overflow-hidden"
          style={{
            borderColor: "color-mix(in srgb, var(--border-subtle) 88%, transparent)",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 84%, transparent), var(--bg-base))",
            boxShadow: "0 28px 64px -42px rgba(0, 0, 0, 0.75)",
          }}
        >
          <MarketFeed
            onAfterSelectMarket={isMobileLg ? () => setTokensSheetOpen(true) : undefined}
          />
        </div>
      </aside>
      {!isMobileLg && (
        <div
          role="separator"
          aria-label="Resize sidebar"
          onMouseDown={startResize}
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)]/20 transition-colors group"
          style={{ minWidth: 4 }}
        >
          <div className="w-0.5 h-full mx-auto bg-[var(--border-subtle)] group-hover:bg-[var(--accent)]/50 transition-colors" />
        </div>
      )}
      <main className="main-panel hidden lg:block min-w-0">
        <div className="lg:hidden">
          <MobileStickyMarket onOpenMarkets={() => setSheetOpen(true)} />
        </div>
        <div
          className="h-full rounded-[20px] border overflow-y-auto overflow-x-hidden"
          style={{
            borderColor: "color-mix(in srgb, var(--border-subtle) 88%, transparent)",
            background:
              "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 7%, transparent), transparent 24%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 86%, transparent), var(--bg-base))",
            boxShadow: "0 32px 72px -48px rgba(0, 0, 0, 0.82)",
          }}
        >
          <MarketExecutionSurface />
        </div>
      </main>
      <TerminalRightPanel />
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
