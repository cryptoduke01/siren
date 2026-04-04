import { create } from "zustand";
import type { TradePnLToken } from "@/components/TradePnLCard";

export interface TradePnLSharePayload {
  token: TradePnLToken;
  profitUsd: number;
  percent: number;
  kalshiMarket: string;
  wallet?: string | null;
  displayName?: string | null;
  executedAt?: number | null;
  stakeUsd?: number | null;
  valueUsd?: number | null;
}

interface TradePnLShareState {
  payload: TradePnLSharePayload | null;
  open: (p: TradePnLSharePayload) => void;
  close: () => void;
}

export const useTradePnLShareStore = create<TradePnLShareState>((set) => ({
  payload: null,
  open: (p) => set({ payload: p }),
  close: () => set({ payload: null }),
}));
