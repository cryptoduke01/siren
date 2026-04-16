"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { MarketExecutionSurface } from "./MarketExecutionSurface";
import { hapticLight } from "@/lib/haptics";

export function TokensForMarketSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { selectedMarket, setBuyPanelOpen } = useSirenStore();
  const canTradeInSiren = !!selectedMarket && (
    selectedMarket.source === "kalshi"
      ? !!(selectedMarket.yes_mint || selectedMarket.no_mint)
      : !!(selectedMarket.yes_token_id || selectedMarket.no_token_id)
  );
  const sourceLabel = selectedMarket?.source === "kalshi" ? "Kalshi" : "Polymarket";
  const marketUrl = selectedMarket
    ? selectedMarket.market_url ||
      selectedMarket.kalshi_url ||
      (selectedMarket.source === "polymarket" ? "https://polymarket.com" : "https://kalshi.com")
    : "https://www.onsiren.xyz";

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 top-[20%] z-50 flex flex-col lg:hidden"
            style={{
              background: "var(--bg-base)",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderTop: "1px solid var(--border-subtle)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div className="flex-shrink-0 p-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onClose();
                }}
                className="w-full flex justify-center pb-2"
                aria-label="Close"
              >
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: "var(--text-3)" }}
                />
              </button>
              {selectedMarket && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-heading font-semibold text-sm truncate"
                      style={{ color: "var(--text-1)" }}
                    >
                      {selectedMarket.title}
                    </p>
                    <p className="font-mono text-xs tabular-nums mt-0.5" style={{ color: "var(--accent)" }}>
                      {selectedMarket.probability.toFixed(0)}% YES
                    </p>
                    <p className="font-body text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
                      {canTradeInSiren
                        ? "Trade here with execution-aware routing."
                        : `Open the ${sourceLabel} page for full market context.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canTradeInSiren ? (
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setBuyPanelOpen(true, "market");
                        }}
                        className="font-body font-medium text-[11px] uppercase h-8 px-3 rounded-[6px] border transition-all duration-[120ms] ease"
                        style={{
                          background: "var(--accent)",
                          borderColor: "var(--accent)",
                          color: "var(--accent-text)",
                        }}
                      >
                        Trade
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          window.open(marketUrl, "_blank", "noopener,noreferrer");
                        }}
                        className="font-body font-medium text-[11px] uppercase h-8 px-3 rounded-[6px] border transition-all duration-[120ms] ease"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: "var(--border-default)",
                          color: "var(--text-1)",
                        }}
                        >
                        Open page
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              <MarketExecutionSurface compactMode />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
