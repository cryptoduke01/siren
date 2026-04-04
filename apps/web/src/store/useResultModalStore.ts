import { create } from "zustand";

export interface ResultModalPayload {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  txSignature?: string;
  actionLabel?: string;
  actionHref?: string;
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
