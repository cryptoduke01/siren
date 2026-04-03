"use client";

import { createContext, useContext } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

type WalletItem = { adapter: { name?: string } };

/**
 * Privy session lifecycle. When `NEXT_PUBLIC_PRIVY_APP_ID` is set we do not fall back to browser extension wallets.
 */
export type WalletSessionGate = "ready" | "privy-loading" | "embedded-provisioning" | "needs-privy-login";

type SirenWalletState = {
  connected: boolean;
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  disconnect: () => void | Promise<void>;
  isReady: boolean;
  /** When not `ready`, signing and sends must not be offered as primary path (Privy modal / embedded wallet not ready). */
  walletSessionStatus: WalletSessionGate;
  canExportPrivateKey: boolean;
  exportPrivateKey: () => Promise<string>;
  connecting: boolean;
  wallet: unknown;
  wallets: WalletItem[];
  select: (name: string) => void;
  connect: () => Promise<void>;
};

const PrivyWalletContext = createContext<SirenWalletState | undefined>(undefined);

function rejectSignNotReady<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
  return Promise.reject(new Error("Wallet is still initializing. Please wait and try again."));
}

function rejectSignNeedsLogin<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
  return Promise.reject(new Error("Sign in to trade."));
}

export function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction: privySignTransaction } = useSignTransaction();

  const solanaWallet = wallets[0];

  let value: SirenWalletState;

  if (!ready) {
    value = {
      connected: false,
      publicKey: null,
      signTransaction: rejectSignNotReady,
      disconnect: async () => {},
      isReady: false,
      walletSessionStatus: "privy-loading",
      canExportPrivateKey: false,
      exportPrivateKey: async () => {
        throw new Error("Wallet is still loading.");
      },
      connecting: true,
      wallet: null,
      wallets: [],
      select: () => {},
      connect: async () => {},
    };
  } else if (authenticated && solanaWallet) {
    const address = solanaWallet.address;
    const publicKey = new PublicKey(address);
    value = {
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
        return Transaction.from(new Uint8Array(signedTransaction)) as T;
      },
      disconnect: logout,
      isReady: true,
      walletSessionStatus: "ready",
      canExportPrivateKey:
        typeof (solanaWallet as unknown as { exportPrivateKey?: unknown; export?: unknown }).exportPrivateKey === "function" ||
        typeof (solanaWallet as unknown as { exportPrivateKey?: unknown; export?: unknown }).export === "function",
      exportPrivateKey: async () => {
        const exportFn =
          (solanaWallet as unknown as { exportPrivateKey?: () => Promise<unknown>; export?: () => Promise<unknown> }).exportPrivateKey ||
          (solanaWallet as unknown as { exportPrivateKey?: () => Promise<unknown>; export?: () => Promise<unknown> }).export;
        if (!exportFn) throw new Error("Private key export is not available for this wallet.");
        const result = await exportFn.call(solanaWallet);
        if (typeof result === "string") return result;
        const key = (result as { privateKey?: string } | null | undefined)?.privateKey;
        if (typeof key === "string" && key.length > 0) return key;
        throw new Error("Private key export is not available for this wallet.");
      },
      connecting: false,
      wallet: null,
      wallets: [],
      select: () => {},
      connect: async () => {},
    };
  } else if (authenticated && !solanaWallet) {
    value = {
      connected: false,
      publicKey: null,
      signTransaction: rejectSignNotReady,
      disconnect: logout,
      isReady: true,
      walletSessionStatus: "embedded-provisioning",
      canExportPrivateKey: false,
      exportPrivateKey: async () => {
        throw new Error("Embedded wallet is still being created.");
      },
      connecting: true,
      wallet: null,
      wallets: [],
      select: () => {},
      connect: async () => {},
    };
  } else {
    value = {
      connected: false,
      publicKey: null,
      signTransaction: rejectSignNeedsLogin,
      disconnect: async () => {},
      isReady: true,
      walletSessionStatus: "needs-privy-login",
      canExportPrivateKey: false,
      exportPrivateKey: async () => {
        throw new Error("Sign in to export a key.");
      },
      connecting: false,
      wallet: null,
      wallets: [],
      select: () => {},
      connect: async () => {},
    };
  }

  return <PrivyWalletContext.Provider value={value}>{children}</PrivyWalletContext.Provider>;
}

export function useSirenWallet(): SirenWalletState {
  const privyBridge = useContext(PrivyWalletContext);
  const adapter = useWallet();

  const adapterState = adapter as unknown as Omit<SirenWalletState, "walletSessionStatus">;
  const fromAdapter: SirenWalletState = {
    ...adapterState,
    isReady: true,
    walletSessionStatus: "ready",
    canExportPrivateKey: adapterState.canExportPrivateKey ?? false,
    exportPrivateKey:
      adapterState.exportPrivateKey ??
      (async () => {
        throw new Error("Private key export is only available for supported embedded wallets.");
      }),
  };

  if (privyBridge === undefined) {
    return fromAdapter;
  }
  return privyBridge;
}
