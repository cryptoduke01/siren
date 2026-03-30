"use client";

import { createContext, useContext } from "react";
import { usePrivy, useWallets as usePrivyWallets } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets, useSignMessage, useSignTransaction } from "@privy-io/react-auth/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

type WalletItem = { adapter: { name?: string } };
type EmbeddedWalletSummary = {
  address: string;
  chainType: string;
  walletClientType?: string;
  connectorType?: string;
};

type SirenWalletState = {
  connected: boolean;
  authenticated: boolean;
  publicKey: PublicKey | null;
  evmAddress: string | null;
  embeddedWallets: EmbeddedWalletSummary[];
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signMessage: (message: string | Uint8Array) => Promise<Uint8Array>;
  getEvmProvider: () => Promise<unknown>;
  switchEvmChain: (chainId: number | `0x${string}`) => Promise<void>;
  disconnect: () => void | Promise<void>;
  isReady: boolean;
  canExportPrivateKey: boolean;
  exportPrivateKey: () => Promise<string>;
  connecting: boolean;
  wallet: unknown;
  wallets: WalletItem[];
  select: (name: string) => void;
  connect: () => Promise<void>;
};

const PrivyWalletContext = createContext<SirenWalletState | null>(null);

export function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets: privyWallets } = usePrivyWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signMessage: privySignMessage } = useSignMessage();
  const { signTransaction: privySignTransaction } = useSignTransaction();

  const solanaWallet = solanaWallets[0];
  const evmWallet =
    privyWallets.find((wallet) => wallet.type === "ethereum" && wallet.walletClientType?.startsWith("privy")) ??
    privyWallets.find((wallet) => wallet.type === "ethereum") ??
    null;
  const embeddedWallets = privyWallets
    .filter((wallet) => wallet.walletClientType?.startsWith("privy"))
    .map((wallet) => ({
      address: wallet.address,
      chainType: wallet.type,
      walletClientType: wallet.walletClientType,
      connectorType: wallet.connectorType,
    }));
  const evmAddress = embeddedWallets.find((wallet) => wallet.chainType === "ethereum")?.address ?? null;

  const value: SirenWalletState | null = ready
    ? {
        connected: Boolean(authenticated && solanaWallet),
        authenticated,
        publicKey: authenticated && solanaWallet ? new PublicKey(solanaWallet.address) : null,
        evmAddress: authenticated ? evmAddress : null,
        embeddedWallets: authenticated ? embeddedWallets : [],
        signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
          if (!solanaWallet) {
            throw new Error("Solana wallet is still being provisioned.");
          }

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
        signMessage: async (message: string | Uint8Array) => {
          if (!solanaWallet) {
            throw new Error("Solana wallet is still being provisioned.");
          }

          const encodedMessage = typeof message === "string" ? new TextEncoder().encode(message) : message;
          const { signature } = await privySignMessage({
            message: encodedMessage,
            wallet: solanaWallet,
          });
          return signature;
        },
        getEvmProvider: async () => {
          if (!evmWallet || !authenticated) {
            throw new Error("Embedded EVM wallet is still being provisioned.");
          }
          return evmWallet.getEthereumProvider();
        },
        switchEvmChain: async (chainId: number | `0x${string}`) => {
          if (!evmWallet || !authenticated) {
            throw new Error("Embedded EVM wallet is still being provisioned.");
          }
          await evmWallet.switchChain(chainId);
        },
        disconnect: logout,
        isReady: !authenticated || Boolean(solanaWallet),
        canExportPrivateKey:
          Boolean(solanaWallet) &&
          (typeof (solanaWallet as unknown as { exportPrivateKey?: unknown; export?: unknown }).exportPrivateKey === "function" ||
            typeof (solanaWallet as unknown as { exportPrivateKey?: unknown; export?: unknown }).export === "function"),
        exportPrivateKey: async () => {
          if (!solanaWallet) {
            throw new Error("Solana wallet is still being provisioned.");
          }

          const exportFn =
            (solanaWallet as unknown as { exportPrivateKey?: () => Promise<unknown>; export?: () => Promise<unknown> })
              .exportPrivateKey ||
            (solanaWallet as unknown as { exportPrivateKey?: () => Promise<unknown>; export?: () => Promise<unknown> }).export;
          if (!exportFn) throw new Error("Private key export is not available for this wallet.");
          const result = await exportFn.call(solanaWallet);
          if (typeof result === "string") return result;
          const key = (result as { privateKey?: string } | null | undefined)?.privateKey;
          if (typeof key === "string" && key.length > 0) return key;
          throw new Error("Private key export is not available for this wallet.");
        },
        connecting: authenticated && !solanaWallet,
        wallet: null,
        wallets: [],
        select: () => {},
        connect: async () => {},
      }
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

  const adapterState = adapter as unknown as SirenWalletState;
  return {
    ...adapterState,
    authenticated: false,
    evmAddress: null,
    embeddedWallets: [],
    signMessage: async (message: string | Uint8Array) => {
      const encodedMessage = typeof message === "string" ? new TextEncoder().encode(message) : message;
      if (typeof adapter.signMessage !== "function") {
        throw new Error("Message signing is not available for this wallet.");
      }
      return adapter.signMessage(encodedMessage);
    },
    getEvmProvider: async () => {
      throw new Error("Embedded EVM wallet support is only available when Privy is enabled.");
    },
    switchEvmChain: async () => {
      throw new Error("Embedded EVM wallet support is only available when Privy is enabled.");
    },
    isReady: true,
    canExportPrivateKey: false,
    exportPrivateKey: async () => {
      throw new Error("Private key export is only available for supported embedded wallets.");
    },
  };
}
