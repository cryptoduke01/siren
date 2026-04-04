import { create } from "zustand";
import type { TradePnLSharePayload } from "./useTradePnLShareStore";

export interface ResultModalPayload {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  txSignature?: string;
  /** Where to link EVM-style 0x hashes (default: Base for legacy swaps). */
  txExplorer?: "polygon" | "base" | "solscan";
  actionLabel?: string;
  actionHref?: string;
  /** Opens global PnL share card (one tap from success modals). */
  sharePnL?: TradePnLSharePayload;
}

interface ResultModalState {
  payload: ResultModalPayload | null;
  show: (p: ResultModalPayload) => void;
  hide: () => void;
}

export const useResultModalStore = create<ResultModalState>((set) => ({
  payload: null,
  show: (p) => set({ payload: p }),
  hide: () => set({ payload: null }),
}));
