"use client";

import { useTradePnLShareStore } from "@/store/useTradePnLShareStore";
import { TradePnLCard } from "./TradePnLCard";
import { hapticLight } from "@/lib/haptics";

export function GlobalTradePnLShareModal() {
  const payload = useTradePnLShareStore((s) => s.payload);
  const close = useTradePnLShareStore((s) => s.close);
  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={() => {
        hapticLight();
        close();
      }}
      role="presentation"
    >
      <div className="w-full max-w-[460px]" onClick={(e) => e.stopPropagation()} style={{ borderRadius: "20px" }}>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              close();
            }}
            className="px-3 py-2 rounded-lg font-body text-xs font-medium"
            style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
            aria-label="Close PnL card"
          >
            Close
          </button>
        </div>
        <TradePnLCard
          token={payload.token}
          profitUsd={payload.profitUsd}
          percent={payload.percent}
          kalshiMarket={payload.kalshiMarket}
          marketLabel={payload.marketLabel}
          positionLabel={payload.positionLabel}
          wallet={payload.wallet}
          displayName={payload.displayName}
          executedAt={payload.executedAt}
          stakeUsd={payload.stakeUsd}
          valueUsd={payload.valueUsd}
        />
      </div>
    </div>
  );
}
