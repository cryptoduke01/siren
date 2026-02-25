import { create } from "zustand";

export interface SelectedMarket {
  ticker: string;
  title: string;
  probability: number;
  velocity_1h: number;
  volume?: number;
  open_interest?: number;
  event_ticker?: string;
  subtitle?: string;
  keywords?: string[];
}

export interface SelectedToken {
  mint: string;
  name: string;
  symbol: string;
  price?: number;
  volume24h?: number;
  ctMentions?: number;
}

interface SirenState {
  selectedMarket: SelectedMarket | null;
  selectedToken: SelectedToken | null;
  buyPanelOpen: boolean;
  openForSell: boolean;
  setSelectedMarket: (m: SelectedMarket | null) => void;
  setSelectedToken: (t: SelectedToken | null, opts?: { openForSell?: boolean }) => void;
  setBuyPanelOpen: (open: boolean) => void;
}

export const useSirenStore = create<SirenState>((set) => ({
  selectedMarket: null,
  selectedToken: null,
  buyPanelOpen: false,
  openForSell: false,
  setSelectedMarket: (m) => set({ selectedMarket: m, buyPanelOpen: !!m, openForSell: false }),
  setSelectedToken: (t, opts) => set((s) => ({ selectedToken: t, buyPanelOpen: t ? true : s.buyPanelOpen, openForSell: t && opts?.openForSell ? true : s.openForSell })),
  setBuyPanelOpen: (open) => set((s) => ({ buyPanelOpen: open, ...(open === false ? { openForSell: false } : {}) })),
}));
