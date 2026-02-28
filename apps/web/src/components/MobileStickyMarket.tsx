"use client";

import { ChevronUp } from "lucide-react";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";

function VelocityBadge({ v }: { v: number }) {
  const abs = Math.abs(v);
  const dir = v > 0 ? "+" : "";
  const color = v > 0 ? "var(--green)" : "var(--red)";
  return (
    <span className="font-mono font-semibold tabular-nums" style={{ fontSize: "1rem", color }}>
      {dir}{abs.toFixed(1)}%/hr
    </span>
  );
}

export function MobileStickyMarket({ onOpenMarkets }: { onOpenMarkets: () => void }) {
  const { selectedMarket } = useSirenStore();

  if (!selectedMarket) {
    return (
      <button
        type="button"
        onClick={() => { hapticLight(); onOpenMarkets(); }}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors lg:hidden"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <span className="font-heading font-semibold text-[var(--text-secondary)]">Select a market</span>
        <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
      </button>
    );
  }

  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 rounded-lg border mb-4 lg:hidden"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-heading font-semibold text-[var(--text-tertiary)] truncate mb-0.5">
          {selectedMarket.title}
        </p>
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono font-bold tabular-nums"
            style={{ fontSize: "1.5rem", color: "var(--accent-primary)" }}
          >
            {selectedMarket.probability.toFixed(0)}%
          </span>
          <VelocityBadge v={selectedMarket.velocity_1h} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => { hapticLight(); onOpenMarkets(); }}
        className="flex-shrink-0 p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-label="Change market"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}
