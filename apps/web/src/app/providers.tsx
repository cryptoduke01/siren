"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyWalletBridge } from "@/contexts/SirenWalletContext";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => rpcUrl, []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new TorusWalletAdapter()],
    []
  );

  const content = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );

  if (privyAppId) {
    return (
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["wallet", "email", "google", "github", "twitter"],
          appearance: {
            walletChainType: "solana-only",
            showWalletLoginFirst: true,
          },
          embeddedWallets: {
            solana: {
              createOnLogin: "all-users",
            },
          },
          legal: {
            termsAndConditionsUrl: "https://onsiren.xyz/terms",
            privacyPolicyUrl: "https://onsiren.xyz/privacy",
          },
        }}
      >
        <PrivyWalletBridge>{content}</PrivyWalletBridge>
      </PrivyProvider>
    );
  }

  return content;
}
