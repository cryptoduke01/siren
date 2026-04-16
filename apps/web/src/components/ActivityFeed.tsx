"use client";

import { useMarkets } from "@/hooks/useMarkets";
import { useSirenStore } from "@/store/useSirenStore";
import { hapticLight } from "@/lib/haptics";
import { toSelectedMarket } from "@/lib/marketSelection";

export function ActivityFeed() {
  const { data: markets = [] } = useMarkets();
  const { setSelectedMarket } = useSirenStore();

  const newMarkets = markets.slice(0, 5);

  if (newMarkets.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 rounded-[10px] border p-5 mb-6"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
    >
      <div className="mb-3">
        <h3 className="font-heading font-semibold text-[11px] mb-1" style={{ letterSpacing: "0.12em", color: "var(--text-3)" }}>
          WHAT&apos;S MOVING
        </h3>
        <p className="font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Recent prediction markets in your feed. Click to open execution context.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {newMarkets.map((m) => (
          <button
            key={m.ticker}
            type="button"
            onClick={() => {
              hapticLight();
              setSelectedMarket(toSelectedMarket(m));
            }}
            className="font-body text-[11px] px-3 py-2 rounded-[6px] truncate max-w-[160px] transition-all duration-[120ms] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-active)]"
            style={{ color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
          >
            {m.title.slice(0, 28)}
            {m.title.length > 28 ? "…" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
