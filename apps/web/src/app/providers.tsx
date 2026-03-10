"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { isDynamicConfigured } from "@/lib/dynamic";
import { CaptureDynamicContext } from "@/contexts/SirenWalletContext";

const dynamicEnvId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"),
    []
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new TorusWalletAdapter()],
    []
  );

  const content = (
    <AuthProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          {children}
        </WalletProvider>
      </ConnectionProvider>
    </AuthProvider>
  );

  if (dynamicEnvId && isDynamicConfigured()) {
    return (
      <DynamicContextProvider
        settings={{
          environmentId: dynamicEnvId,
          walletConnectors: [SolanaWalletConnectors],
        }}
      >
        <CaptureDynamicContext>
          {content}
        </CaptureDynamicContext>
      </DynamicContextProvider>
    );
  }

  return content;
}
