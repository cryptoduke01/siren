"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSirenStore } from "@/store/useSirenStore";
import { useMarketActivity } from "@/hooks/useMarketActivity";
import { ExternalLink } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import type { MarketOutcome } from "@siren/shared";

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
  const { data: marketActivity } = useMarketActivity(selectedMarket?.source === "kalshi" ? selectedMarket.ticker : undefined);
  const isOpen = !!selectedMarket && detailPanelOpen;
  const reduceMotion = useReducedMotion();

  if (!selectedMarket || !detailPanelOpen) return null;

  const yesPct = Math.min(100, Math.max(0, selectedMarket.probability));
  const noPct = 100 - yesPct;
  const canTradeInApp = selectedMarket.source === "kalshi"
    ? !!(selectedMarket.yes_mint || selectedMarket.no_mint)
    : !!(selectedMarket.yes_token_id || selectedMarket.no_token_id);
  const marketUrl =
    selectedMarket.market_url ||
    selectedMarket.kalshi_url ||
    (selectedMarket.source === "polymarket" ? "https://polymarket.com" : "https://kalshi.com");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailPanelOpen(false)}
        >
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-2xl rounded-2xl border overflow-hidden"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-4 border-b md:px-5" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>Market details</span>
              <button
                type="button"
                onClick={() => { hapticLight(); setDetailPanelOpen(false); }}
                className="h-10 min-w-10 p-2 rounded-[10px] border transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ color: "var(--text-2)" }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 md:px-5 md:py-5">
              <h2 className="font-heading font-semibold text-base leading-snug" style={{ color: "var(--text-1)" }}>
                {selectedMarket.title}
              </h2>
              {selectedMarket.subtitle && (
                <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>{selectedMarket.subtitle}</p>
              )}

              {/* Outcomes */}
              {selectedMarket.outcomes && selectedMarket.outcomes.length > 2 ? (
                <div>
                  <p className="font-body text-xs mb-2" style={{ color: "var(--text-3)" }}>Outcomes</p>
                  <div className="space-y-1.5">
                    {(selectedMarket.outcomes as MarketOutcome[])
                      .sort((a, b) => b.probability - a.probability)
                      .map((outcome, idx) => (
                        <div
                          key={outcome.ticker ?? idx}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                        >
                          <span className="font-body text-xs" style={{ color: "var(--text-1)" }}>
                            {outcome.label}
                          </span>
                          <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
                            {outcome.probability.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
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
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Velocity (1h)</p>
                  <VelocityBadge v={selectedMarket.velocity_1h} />
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Trades (24h)</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{marketActivity?.recentTrades?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Volume (24h)</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.volume_24h?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Volume</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.volume?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Open interest</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.open_interest?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Liquidity</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{selectedMarket.liquidity?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="rounded-xl border p-4 md:col-span-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <p className="font-body text-xs mb-1" style={{ color: "var(--text-3)" }}>Last trade</p>
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-1)" }}>{marketActivity?.lastTradeAt ? new Date(marketActivity.lastTradeAt).toLocaleTimeString() : "—"}</p>
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
                    className="w-full py-4 rounded-xl font-heading font-semibold text-base transition-opacity duration-[120ms] ease hover:opacity-90 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Trade here
                  </button>
                  <a
                    href={marketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="w-full py-3 rounded-xl font-body font-medium text-sm transition-opacity duration-[120ms] ease hover:opacity-90 flex items-center justify-center gap-2 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-2)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Open source page
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-center font-body text-xs" style={{ color: "var(--text-3)" }}>
                    Orders can take a few seconds to finish after your wallet confirms.
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={marketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-heading font-semibold text-base transition-opacity duration-[120ms] ease hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Open source page
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-center font-body text-xs mt-2" style={{ color: "var(--text-3)" }}>
                    {selectedMarket.source === "kalshi"
                      ? "This market is not ready to trade inside Siren yet."
                      : "This market is not ready to trade inside Siren yet."}
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
