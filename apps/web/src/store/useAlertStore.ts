import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MarketAlert = { type: "market"; ticker: string; kind: "above" | "below"; value: number };
type Alert = MarketAlert;

interface AlertState {
  alerts: Alert[];
  addMarketAlert: (ticker: string, kind: "above" | "below", value: number) => void;
  removeMarketAlert: (ticker: string) => void;
  getMarketAlerts: (ticker: string) => MarketAlert[];
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      addMarketAlert: (ticker, kind, value) =>
        set((s) => ({
          alerts: [...s.alerts.filter((a) => !(a.type === "market" && a.ticker === ticker)), { type: "market", ticker, kind, value }],
        })),
      removeMarketAlert: (ticker) =>
        set((s) => ({ alerts: s.alerts.filter((a) => !(a.type === "market" && a.ticker === ticker)) })),
      getMarketAlerts: (ticker) => get().alerts.filter((a): a is MarketAlert => a.type === "market" && a.ticker === ticker),
    }),
    { name: "siren-alerts" }
  )
);
