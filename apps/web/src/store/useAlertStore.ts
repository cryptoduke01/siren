import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MarketAlert = { type: "market"; ticker: string; kind: "above" | "below"; value: number };
export type TokenAlert = { type: "token"; mint: string; kind: "pump" | "dump"; pct: number; lastPrice?: number };

type Alert = MarketAlert | TokenAlert;

interface AlertState {
  alerts: Alert[];
  addMarketAlert: (ticker: string, kind: "above" | "below", value: number) => void;
  removeMarketAlert: (ticker: string) => void;
  addTokenAlert: (mint: string, kind: "pump" | "dump", pct: number, lastPrice?: number) => void;
  removeTokenAlert: (mint: string) => void;
  getMarketAlerts: (ticker: string) => MarketAlert[];
  getTokenAlerts: (mint: string) => TokenAlert[];
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
      addTokenAlert: (mint, kind, pct, lastPrice) =>
        set((s) => ({
          alerts: [...s.alerts.filter((a) => !(a.type === "token" && a.mint === mint)), { type: "token", mint, kind, pct, lastPrice }],
        })),
      removeTokenAlert: (mint) =>
        set((s) => ({ alerts: s.alerts.filter((a) => !(a.type === "token" && a.mint === mint)) })),
      getMarketAlerts: (ticker) => get().alerts.filter((a): a is MarketAlert => a.type === "market" && a.ticker === ticker),
      getTokenAlerts: (mint) => get().alerts.filter((a): a is TokenAlert => a.type === "token" && a.mint === mint),
    }),
    { name: "siren-alerts" }
  )
);
