"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { ExternalLink } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "var(--up)" : "var(--down)";
  const arrow = v > 0 ? "▲" : "▼";
  return (
    <span className="font-mono text-sm tabular-nums" style={{ color }}>
      {arrow} {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

export function MarketDetailPanel() {
  const { selectedMarket, setBuyPanelOpen, detailPanelOpen, setDetailPanelOpen } = useSirenStore();
  const isOpen = !!selectedMarket && detailPanelOpen;

  if (!selectedMarket || !detailPanelOpen) return null;

  const yesPct = Math.min(100, Math.max(0, selectedMarket.probability));
  const noPct = 100 - yesPct;
  const canTradeInApp = !!(selectedMarket.yes_mint || selectedMarket.no_mint);

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
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-lg rounded-[8px] border overflow-hidden"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>Market</span>
              <button
                type="button"
                onClick={() => { hapticLight(); setDetailPanelOpen(false); }}
                className="p-2 rounded-[6px] transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-2)" }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <h2 className="font-heading font-semibold text-base leading-snug" style={{ color: "var(--text-1)" }}>
                {selectedMarket.title}
              </h2>
              {selectedMarket.subtitle && (
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>{selectedMarket.subtitle}</p>
              )}

              <div>
                <p className="font-body text-xs mb-2" style={{ color: "var(--text-3)" }}>Probability</p>
                <div className="w-full h-[3px] rounded-[2px] flex overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                  <div
                    className="h-full rounded-l-[2px] shrink-0"
                    style={{ width: `${yesPct}%`, background: "var(--accent)" }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="font-mono tabular-nums" style={{ color: "var(--kalshi)" }}>{yesPct.toFixed(1)}% YES</span>
                  <span className="font-mono tabular-nums" style={{ color: "var(--text-3)" }}>{noPct.toFixed(1)}% NO</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[6px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Velocity (1h)</p>
                  <VelocityBadge v={selectedMarket.velocity_1h} />
                </div>
                <div className="rounded-[6px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Volume</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.volume?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-[6px] border p-4 col-span-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Open interest</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.open_interest?.toLocaleString() ?? "—"}</p>
                </div>
              </div>

              {canTradeInApp ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setDetailPanelOpen(false);
                      setBuyPanelOpen(true, "market");
                    }}
                    className="w-full py-4 rounded-[6px] font-heading font-semibold text-base transition-opacity duration-[120ms] ease hover:opacity-90 flex items-center justify-center gap-2"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Trade In Siren
                  </button>
                  <a
                    href={selectedMarket.kalshi_url || "https://kalshi.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="w-full py-3 rounded-[6px] font-body font-medium text-sm transition-opacity duration-[120ms] ease hover:opacity-90 flex items-center justify-center gap-2 border"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-2)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Trade on Kalshi
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-center font-body text-xs" style={{ color: "var(--text-3)" }}>
                    Outcome-token trades route through DFlow and may settle asynchronously.
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={selectedMarket.kalshi_url || "https://kalshi.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-[6px] font-heading font-semibold text-base transition-opacity duration-[120ms] ease hover:opacity-90"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Trade on Kalshi
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-center font-body text-xs mt-2" style={{ color: "var(--text-3)" }}>
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
