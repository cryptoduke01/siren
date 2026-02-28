import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WalletType = "phantom" | "solflare" | "torus" | "walletconnect" | null;

interface WalletTypeState {
  walletType: WalletType;
  setWalletType: (type: WalletType) => void;
}

export const useWalletTypeStore = create<WalletTypeState>()(
  persist(
    (set) => ({
      walletType: null,
      setWalletType: (type) => set({ walletType: type }),
    }),
    { name: "siren-wallet-type" }
  )
);
