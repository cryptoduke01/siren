"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { ExternalLink, Clock, BarChart3, TrendingUp } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "text-siren-kalshi" : "text-red-400";
  return <span className={`text-sm font-data tabular-nums ${color}`}>{dir}{abs.toFixed(1)}%/hr</span>;
}

export function MarketDetailPanel() {
  const { selectedMarket, setSelectedMarket, setBuyPanelOpen, detailPanelOpen, setDetailPanelOpen } = useSirenStore();
  const isOpen = !!selectedMarket && detailPanelOpen;

  if (!selectedMarket || !detailPanelOpen) return null;

  const yesPct = Math.min(100, Math.max(0, selectedMarket.probability));
  const noPct = 100 - yesPct;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailPanelOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", duration: 0.35 }}
            className="relative w-full max-w-lg rounded-2xl border border-siren-border bg-siren-surface dark:bg-siren-bg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-6 pb-4">
              <div className="flex items-center gap-2 text-siren-text-secondary text-sm">
                <Clock className="w-4 h-4" />
                <span>Market</span>
              </div>
              <button
                type="button"
                onClick={() => { hapticLight(); setDetailPanelOpen(false); }}
                className="p-2 rounded-full text-siren-text-secondary hover:text-siren-text-primary hover:bg-siren-border transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 pb-6 space-y-5">
              <h2 className="font-heading font-semibold text-lg text-siren-text-primary leading-snug">
                {selectedMarket.title}
              </h2>
              {selectedMarket.subtitle && (
                <p className="text-siren-text-secondary text-sm">{selectedMarket.subtitle}</p>
              )}

              <div>
                <p className="text-siren-text-secondary text-xs font-medium mb-2 uppercase tracking-wider">Probability</p>
                <div className="flex gap-1 w-full h-4 rounded-full overflow-hidden bg-siren-border">
                  <motion.div
                    className="bg-siren-kalshi"
                    initial={{ width: 0 }}
                    animate={{ width: `${yesPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <motion.div
                    className="bg-siren-secondary/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${noPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-siren-kalshi font-data tabular-nums">{yesPct.toFixed(1)}% YES</span>
                  <span className="text-siren-text-secondary font-data tabular-nums">{noPct.toFixed(1)}% NO</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-siren-border bg-siren-bg/50 dark:bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-siren-text-secondary text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Velocity (1h)
                  </div>
                  <VelocityBadge v={selectedMarket.velocity_1h} />
                </div>
                <div className="rounded-xl border border-siren-border bg-siren-bg/50 dark:bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-siren-text-secondary text-xs mb-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Volume
                  </div>
                  <p className="font-data text-siren-text-primary tabular-nums">{selectedMarket.volume?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-siren-border bg-siren-bg/50 dark:bg-white/5 p-4 col-span-2">
                  <div className="text-siren-text-secondary text-xs mb-1">Open interest</div>
                  <p className="font-data text-siren-text-primary tabular-nums">{selectedMarket.open_interest?.toLocaleString() ?? "—"}</p>
                </div>
              </div>

              {(selectedMarket.yes_mint || selectedMarket.no_mint) ? (
                <>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); setBuyPanelOpen(true, "market"); }}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-siren-primary text-white dark:text-siren-bg font-heading font-semibold text-base hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    Buy YES / Buy NO
                  </button>
                  <a
                    href={selectedMarket.kalshi_url || "https://kalshi.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="block text-center text-siren-text-secondary text-xs hover:text-siren-primary"
                  >
                    View on Kalshi →
                  </a>
                </>
              ) : (
                <>
                  <a
                    href={selectedMarket.kalshi_url || "https://kalshi.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-siren-primary text-white dark:text-siren-bg font-heading font-semibold text-base hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    Trade on Kalshi
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-center text-siren-text-secondary text-xs mt-2">
                    In-app trading requires outcome mints. Use Kalshi for this market.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
