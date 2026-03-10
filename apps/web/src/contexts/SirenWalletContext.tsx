"use client";

import { createContext, useContext, useMemo } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { Transaction } from "@solana/web3.js";

const SirenDynamicContext = createContext<ReturnType<typeof useDynamicContext> | null>(null);

export function CaptureDynamicContext({ children }: { children: React.ReactNode }) {
  const ctx = useDynamicContext();
  const value = useMemo(() => ctx, [ctx]);
  return (
    <SirenDynamicContext.Provider value={value}>
      {children}
    </SirenDynamicContext.Provider>
  );
}

export function useSirenWallet() {
  const dynamicCtx = useContext(SirenDynamicContext);
  const adapter = useWallet();

  if (
    dynamicCtx?.primaryWallet &&
    isSolanaWallet(dynamicCtx.primaryWallet)
  ) {
    const pw = dynamicCtx.primaryWallet;
    const publicKey = new PublicKey(pw.address);
    return {
      connected: true,
      publicKey,
      signTransaction: async (transaction: Transaction) => {
        const signer = await pw.getSigner();
        return (signer as { signTransaction: (tx: Transaction) => Promise<Transaction> }).signTransaction(transaction);
      },
      disconnect: async () => {
        try {
          (dynamicCtx as { handleLogOut?: () => void })?.handleLogOut?.();
        } catch {
          /* ignore */
        }
      },
      connecting: false,
      wallet: null,
      wallets: [],
      select: () => {},
      connect: async () => {},
    };
  }

  return adapter;
}
