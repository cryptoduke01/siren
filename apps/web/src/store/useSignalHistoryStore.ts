import { create } from "zustand";
import { persist } from "zustand/middleware";

type MarketSignal = {
  id: string;
  ts: number;
  type: "market";
  ticker: string;
  kind: "above" | "below";
  threshold: number;
  probabilityAtFire: number;
  title?: string;
};
export type SignalHistoryItem = MarketSignal;

interface SignalHistoryState {
  signals: SignalHistoryItem[];
  addMarketSignal: (s: Omit<MarketSignal, "id">) => void;
  clearSignals: () => void;
}

let signalIdN = 0;

export const useSignalHistoryStore = create<SignalHistoryState>()(
  persist(
    (set) => ({
      signals: [],
      addMarketSignal: (s) => {
        const id = `ms_${Date.now()}_${++signalIdN}`;
        set((state) => ({
          signals: [{ ...s, id }, ...state.signals].slice(0, 100),
        }));
      },
      clearSignals: () => set({ signals: [] }),
    }),
    { name: "siren-signal-history" }
  )
);

