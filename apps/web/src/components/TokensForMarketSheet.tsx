"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { TokenSurface } from "./TokenSurface";
import { hapticLight } from "@/lib/haptics";

export function TokensForMarketSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { selectedMarket, setBuyPanelOpen, setDetailPanelOpen } = useSirenStore();

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
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setDetailPanelOpen(true);
                      }}
                      className="p-2 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{ color: "var(--text-2)" }}
                      title="Market details"
                    >
                      &#9432;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setBuyPanelOpen(true, "market");
                      }}
                      className="font-body font-medium text-[11px] uppercase h-8 px-3 rounded-[6px] border transition-all duration-[120ms] ease"
                      style={{
                        background: "var(--bg-elevated)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-1)",
                      }}
                    >
                      Trade market
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              <TokenSurface />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
