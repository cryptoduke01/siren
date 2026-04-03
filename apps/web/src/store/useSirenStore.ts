import { create } from "zustand";
import type { PredictionSignal, SignalSource } from "@siren/shared";

export interface SelectedMarket {
  source: SignalSource;
  ticker: string;
  platform_id?: string;
  market_url?: string;
  market_slug?: string;
  condition_id?: string;
  title: string;
  probability: number;
  velocity_1h: number;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  open_interest?: number;
  close_time?: number;
  open_time?: number;
  event_ticker?: string;
  series_ticker?: string;
  subtitle?: string;
  keywords?: string[];
  yes_mint?: string;
  no_mint?: string;
  yes_token_id?: string;
  no_token_id?: string;
  kalshi_url?: string;
}

export interface SelectedToken {
  mint: string;
  name: string;
  symbol: string;
  assetType?: "spot" | "prediction";
  price?: number;
  volume24h?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  holders?: number;
  bondingCurveStatus?: "bonded" | "bonding" | "unknown";
  rugcheckScore?: number;
  safe?: boolean;
  ctMentions?: number;
  riskScore?: number;
  riskLabel?: "low" | "moderate" | "high" | "critical";
  riskReasons?: string[];
  riskBlocked?: boolean;
  marketTicker?: string;
  marketTitle?: string;
  marketSide?: "yes" | "no";
  marketProbability?: number;
  kalshiUrl?: string;
}

type BuyPanelMode = "market" | "token";

interface SirenState {
  selectedMarket: SelectedMarket | null;
  selectedSignal: PredictionSignal | null;
  selectedToken: SelectedToken | null;
  buyPanelOpen: boolean;
  buyPanelMode: BuyPanelMode;
  openForSell: boolean;
  detailPanelOpen: boolean;
  setSelectedMarket: (m: SelectedMarket | null) => void;
  setSelectedSignal: (signal: PredictionSignal | null) => void;
  setSelectedToken: (t: SelectedToken | null, opts?: { openForSell?: boolean }) => void;
  setBuyPanelOpen: (open: boolean, mode?: BuyPanelMode) => void;
  setDetailPanelOpen: (open: boolean) => void;
}

export const useSirenStore = create<SirenState>((set) => ({
  selectedMarket: null,
  selectedSignal: null,
  selectedToken: null,
  buyPanelOpen: false,
  buyPanelMode: "market",
  openForSell: false,
  detailPanelOpen: false,
  setSelectedMarket: (m) =>
    set({
      selectedMarket: m,
      selectedSignal: null,
      buyPanelOpen: false,
      detailPanelOpen: false,
      openForSell: false,
    }),
  setSelectedSignal: (signal) =>
    set({
      selectedSignal: signal,
      selectedMarket: null,
      buyPanelOpen: false,
      detailPanelOpen: false,
      openForSell: false,
    }),
  setSelectedToken: (t, opts) =>
    set((s) => ({
      selectedToken: t,
      buyPanelOpen: t ? true : s.buyPanelOpen,
      buyPanelMode: t ? "token" : s.buyPanelMode,
      openForSell: t && opts?.openForSell ? true : s.openForSell,
    })),
  setBuyPanelOpen: (open, mode) =>
    set((s) => ({
      buyPanelOpen: open,
      buyPanelMode: open && mode ? mode : s.buyPanelMode,
      ...(open === false ? { openForSell: false } : {}),
    })),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
}));
