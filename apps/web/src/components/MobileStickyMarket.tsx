"use client";

import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "var(--up)" : "var(--down)";
  const arrow = v > 0 ? "▲" : "▼";
  return (
    <span className="font-mono text-[11px] tabular-nums" style={{ color }}>
      {arrow} {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

export function MobileStickyMarket({ onOpenMarkets }: { onOpenMarkets: () => void }) {
  const { selectedMarket } = useSirenStore();

  if (!selectedMarket) return null;

  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 mb-4"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        minHeight: 80,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold text-sm truncate mb-1" style={{ color: "var(--text-1)" }}>
          {selectedMarket.title}
        </p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xl font-normal tabular-nums" style={{ color: "var(--accent)" }}>
            {selectedMarket.probability.toFixed(0)}%
          </span>
          <VelocityBadge v={selectedMarket.velocity_1h} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => { hapticLight(); onOpenMarkets(); }}
        className="flex-shrink-0 p-2 rounded-[6px] transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--text-2)" }}
        aria-label="Change market"
      >
        &#8593;
      </button>
    </div>
  );
}
