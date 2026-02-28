"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"),
    []
  );

  const wallets = useMemo(() => {
    const base = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ];
    if (WC_PROJECT_ID) {
      base.push(
        new WalletConnectWalletAdapter({
          network: "mainnet-beta",
          options: {
            relayUrl: "wss://relay.walletconnect.com",
            projectId: WC_PROJECT_ID,
            metadata: {
              name: "Siren",
              description: "Event-driven meme token terminal",
              url: typeof window !== "undefined" ? window.location.origin : "https://siren.terminal",
              icons: ["/icon.png"],
            },
          },
        })
      );
    }
    return base;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
