"use client";

import { createContext, useContext } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

type WalletItem = { adapter: { name?: string } };

type SirenWalletState = {
  connected: boolean;
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  disconnect: () => void | Promise<void>;
  connecting: boolean;
  wallet: unknown;
  wallets: WalletItem[];
  select: (name: string) => void;
  connect: () => Promise<void>;
};

const PrivyWalletContext = createContext<SirenWalletState | null>(null);

export function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction: privySignTransaction } = useSignTransaction();

  const solanaWallet = wallets[0];

  const value: SirenWalletState | null =
    ready && authenticated && solanaWallet
      ? (() => {
          const address = solanaWallet.address;
          const publicKey = new PublicKey(address);
          return {
            connected: true,
            publicKey,
            signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
              const isVersioned = "version" in tx;
              const serialized = isVersioned
                ? (tx as VersionedTransaction).serialize()
                : (tx as Transaction).serialize({
                    requireAllSignatures: false,
                    verifySignatures: false,
                  });

              const { signedTransaction } = await privySignTransaction({
                transaction: new Uint8Array(serialized),
                wallet: solanaWallet,
              });

              if (isVersioned) {
                return VersionedTransaction.deserialize(signedTransaction) as T;
              }
              return Transaction.from(Buffer.from(signedTransaction)) as T;
            },
            disconnect: logout,
            connecting: false,
            wallet: null,
            wallets: [],
            select: () => {},
            connect: async () => {},
          };
        })()
      : null;

  return (
    <PrivyWalletContext.Provider value={value}>
      {children}
    </PrivyWalletContext.Provider>
  );
}

export function useSirenWallet(): SirenWalletState {
  const privyState = useContext(PrivyWalletContext);
  const adapter = useWallet();

  if (privyState) {
    return privyState;
  }

  return adapter as unknown as SirenWalletState;
}
