"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useAlertStore } from "@/store/useAlertStore";
import { hapticLight } from "@/lib/haptics";

export function MarketAlertButton({ ticker, probability }: { ticker: string; probability: number }) {
  const { getMarketAlerts, addMarketAlert, removeMarketAlert } = useAlertStore();
  const [open, setOpen] = useState(false);
  const alerts = getMarketAlerts(ticker);
  const hasAlert = alerts.length > 0;

  const handleAdd = (kind: "above" | "below", value: number) => {
    hapticLight();
    addMarketAlert(ticker, kind, value);
    setOpen(false);
  };

  const handleRemove = () => {
    hapticLight();
    removeMarketAlert(ticker);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); hapticLight(); setOpen((o) => !o); }}
        className="p-1 rounded-[4px] text-[10px] transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: hasAlert ? "var(--yellow)" : "var(--text-3)" }}
        title="Set alert"
      >
        <Bell className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-20 rounded-[6px] border p-2 min-w-[140px]"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-body text-[10px] mb-2" style={{ color: "var(--text-3)" }}>Alert when</p>
            <button type="button" onClick={() => handleAdd("above", 60)} className="block w-full text-left font-body text-[11px] py-1 hover:bg-[var(--bg-hover)] rounded px-2" style={{ color: "var(--text-1)" }}>
              YES ≥ 60%
            </button>
            <button type="button" onClick={() => handleAdd("above", 80)} className="block w-full text-left font-body text-[11px] py-1 hover:bg-[var(--bg-hover)] rounded px-2" style={{ color: "var(--text-1)" }}>
              YES ≥ 80%
            </button>
            <button type="button" onClick={() => handleAdd("below", 40)} className="block w-full text-left font-body text-[11px] py-1 hover:bg-[var(--bg-hover)] rounded px-2" style={{ color: "var(--text-1)" }}>
              YES ≤ 40%
            </button>
            {hasAlert && (
              <button type="button" onClick={handleRemove} className="block w-full text-left font-body text-[11px] py-1 mt-1 rounded px-2" style={{ color: "var(--down)" }}>
                Remove alert
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
