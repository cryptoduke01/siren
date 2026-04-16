"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { hapticLight } from "@/lib/haptics";
import { StarButton } from "./StarButton";
import { ImmersiveMarketCard } from "./ImmersiveMarketCard";
import type { MarketWithVelocity } from "@siren/shared";
import { marketMatchesCategory, type MarketCategoryId } from "@/lib/marketFeedFilters";

const CATEGORIES: MarketCategoryId[] = ["all", "sports", "politics", "crypto", "finance", "entertainment"];

const CATEGORY_TAB_LABEL: Record<MarketCategoryId, string> = {
  all: "All",
  sports: "Sports",
  politics: "Politics",
  crypto: "Crypto",
  finance: "Finance",
  entertainment: "Fun",
};

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
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const cat = (CATEGORIES.includes(activeCategory as MarketCategoryId) ? activeCategory : "all") as MarketCategoryId;

  const filteredMarkets =
    cat === "all" ? markets : markets.filter((m) => marketMatchesCategory(m, cat));

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
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { y: 0 } : { y: "100%" }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[82vh] flex flex-col lg:hidden rounded-t-[24px] border-t"
            style={{
              background: "var(--bg-base)",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 -24px 48px rgba(0,0,0,0.45)",
            }}
          >
            <div className="flex-shrink-0 p-3 pb-2">
              <button type="button" onClick={onClose} className="w-full flex justify-center pb-2" aria-label="Close">
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--text-3)" }} />
              </button>
              <h2 className="font-heading font-black text-center text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-1)" }}>
                Markets
              </h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hidden mt-3 pb-1 snap-x">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setActiveCategory(c);
                    }}
                    className="snap-start shrink-0 rounded-full px-3.5 py-2 font-heading text-[10px] font-bold uppercase tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    style={{
                      color: cat === c ? "var(--accent-text)" : "var(--text-3)",
                      background: cat === c ? "var(--accent)" : "var(--bg-surface)",
                      border: `1px solid ${cat === c ? "var(--accent)" : "var(--border-subtle)"}`,
                    }}
                  >
                    {CATEGORY_TAB_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hidden px-3 pt-0 pb-8 md:px-4">
              {isLoading ? (
                <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-card rounded-[22px]" style={{ height: 180 }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                  {filteredMarkets.map((m) => (
                    <div key={m.ticker} className="relative">
                      <div className="absolute top-3 right-3 z-[2]">
                        <StarButton type="market" id={m.ticker} />
                      </div>
                      <ImmersiveMarketCard
                        market={m}
                        isSelected={false}
                        isHot={false}
                        layout="sheet"
                        onSelect={() => {
                          hapticLight();
                          onSelectMarket(m);
                          onClose();
                        }}
                      />
                    </div>
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
