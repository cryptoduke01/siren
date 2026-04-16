"use client";

import { useEffect, useRef } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useAlertStore } from "@/store/useAlertStore";
import { useToastStore } from "@/store/useToastStore";
import { useSignalHistoryStore } from "@/store/useSignalHistoryStore";

export function AlertChecker() {
  const { data: markets = [] } = useMarkets();
  const addToast = useToastStore((s) => s.addToast);
  const alerts = useAlertStore((s) => s.alerts);
  const addMarketSignal = useSignalHistoryStore((s) => s.addMarketSignal);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const marketAlerts = alerts.filter((a) => a.type === "market") as {
      type: "market";
      ticker: string;
      kind: "above" | "below";
      value: number;
    }[];
    for (const a of marketAlerts) {
      const m = markets.find((x) => x.ticker === a.ticker);
      if (!m) continue;
      const key = `market-${a.ticker}-${a.kind}-${a.value}`;
      if (a.kind === "above" && m.probability >= a.value) {
        if (!firedRef.current.has(key)) {
          firedRef.current.add(key);
          addMarketSignal({
            ts: Date.now(),
            type: "market",
            ticker: a.ticker,
            kind: a.kind,
            threshold: a.value,
            probabilityAtFire: m.probability,
            title: m.title,
          });
          addToast(`${m.title?.slice(0, 40)}… reached ${m.probability.toFixed(0)}% YES (≥ ${a.value}%)`, "info");
        }
      } else if (a.kind === "below" && m.probability <= a.value) {
        if (!firedRef.current.has(key)) {
          firedRef.current.add(key);
          addMarketSignal({
            ts: Date.now(),
            type: "market",
            ticker: a.ticker,
            kind: a.kind,
            threshold: a.value,
            probabilityAtFire: m.probability,
            title: m.title,
          });
          addToast(`${m.title?.slice(0, 40)}… dropped to ${m.probability.toFixed(0)}% YES (≤ ${a.value}%)`, "info");
        }
      } else {
        firedRef.current.delete(key);
      }
    }
  }, [markets, alerts, addToast, addMarketSignal]);

  return null;
}
