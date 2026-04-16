"use client";

import { useMemo } from "react";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useSignalHistoryStore } from "@/store/useSignalHistoryStore";

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function SignalHistoryPanel({ variant = "card" }: { variant?: "card" | "panel" } = {}) {
  const signals = useSignalHistoryStore((s) => s.signals);

  const recent = useMemo(() => signals.slice(0, 12), [signals]);
  if (recent.length === 0) {
    if (variant === "panel") {
      return (
        <div
          className="rounded-2xl border border-dashed p-4"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
        >
          <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
            No recent signals
          </p>
          <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
            Once a market alert fires, it will appear here with the time and move that triggered it.
          </p>
        </div>
      );
    }

    return null;
  }

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3
            className="font-heading font-semibold text-[11px] mb-1"
            style={{ letterSpacing: "0.12em", color: "var(--text-3)" }}
          >
            SIGNAL HISTORY
          </h3>
          <p className="font-body text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            What fired recently from your tracked thresholds.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0" style={{ color: "var(--text-3)" }}>
          <Clock className="w-4 h-4" />
          <span className="font-mono text-[11px] tabular-nums">{formatTime(recent[0].ts)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {recent.map((s) => {
          const up = s.kind === "above";
          return (
            <div key={s.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
                  <span style={{ color: up ? "var(--up)" : "var(--down)" }}>{up ? "Market up" : "Market down"}</span>{" "}
                  {s.title ? s.title : s.ticker}
                </p>
                <p className="font-body text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  YES: {s.probabilityAtFire.toFixed(1)}%{" "}
                  {up ? `(≥ ${s.threshold}%)` : `(≤ ${s.threshold}%)`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0" style={{ color: "var(--text-3)" }}>
                {up ? <TrendingUp className="w-4 h-4" style={{ color: "var(--up)" }} /> : <TrendingDown className="w-4 h-4" style={{ color: "var(--down)" }} />}
                <span className="font-mono text-[11px] tabular-nums">{formatTime(s.ts)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (variant === "panel") {
    return content;
  }

  return (
    <div
      className="flex-shrink-0 rounded-[10px] border p-5 mb-6"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
    >
      {content}
    </div>
  );
}
