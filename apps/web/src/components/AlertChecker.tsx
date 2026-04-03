"use client";

import { useEffect, useRef } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useAlertStore } from "@/store/useAlertStore";
import { useToastStore } from "@/store/useToastStore";
import { useSignalHistoryStore } from "@/store/useSignalHistoryStore";
import { API_URL } from "@/lib/apiUrl";

export function AlertChecker() {
  const { data: markets = [] } = useMarkets();
  const addToast = useToastStore((s) => s.addToast);
  const alerts = useAlertStore((s) => s.alerts);
  const addMarketSignal = useSignalHistoryStore((s) => s.addMarketSignal);
  const addTokenSignal = useSignalHistoryStore((s) => s.addTokenSignal);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const marketAlerts = alerts.filter((a) => a.type === "market") as { type: "market"; ticker: string; kind: "above" | "below"; value: number }[];
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
  }, [markets, alerts, addToast]);

  useEffect(() => {
    const tokenAlerts = alerts.filter((a) => a.type === "token") as { type: "token"; mint: string; kind: "pump" | "dump"; pct: number; lastPrice?: number }[];
    if (tokenAlerts.length === 0) return;
    const run = () => tokenAlerts.forEach((a) => {
      if (a.lastPrice == null) return;
      const key = `token-${a.mint}-${a.kind}-${a.pct}`;
      fetch(`${API_URL}/api/token-info?mint=${encodeURIComponent(a.mint)}`, { credentials: "omit" })
        .then((r) => r.json())
        .then((j) => {
          const price = j.data?.priceUsd;
          if (price == null) return;
          const change = ((price - a.lastPrice!) / a.lastPrice!) * 100;
          if (a.kind === "pump" && change >= a.pct && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            addTokenSignal({
              ts: Date.now(),
              type: "token",
              mint: a.mint,
              kind: a.kind,
              thresholdPct: a.pct,
              changePctAtFire: change,
              priceUsdAtFire: price,
              symbol: j.data?.symbol,
            });
            addToast(`Token +${change.toFixed(1)}% from your alert`, "info");
          } else if (a.kind === "dump" && change <= -a.pct && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            addTokenSignal({
              ts: Date.now(),
              type: "token",
              mint: a.mint,
              kind: a.kind,
              thresholdPct: a.pct,
              changePctAtFire: change,
              priceUsdAtFire: price,
              symbol: j.data?.symbol,
            });
            addToast(`Token ${change.toFixed(1)}% from your alert`, "info");
          } else if (Math.abs(change) < a.pct * 0.5) {
            firedRef.current.delete(key);
          }
        })
        .catch(() => {});
    });
    run();
    const id = setInterval(run, 60_000);
    return () => clearInterval(id);
  }, [alerts, addToast]);

  return null;
}
