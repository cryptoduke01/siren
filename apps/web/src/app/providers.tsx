"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { PrivyProvider, SUPPORTED_CHAINS } from "@privy-io/react-auth";
import { PrivyWalletBridge } from "@/contexts/SirenWalletContext";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const enabledEvmChains = SUPPORTED_CHAINS.filter((chain) =>
  new Set(["1", "137", "8453"]).has(String(chain.id))
);
const defaultEvmChain = enabledEvmChains.find((chain) => String(chain.id) === "8453") ?? enabledEvmChains[0];

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => rpcUrl, []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BackpackWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
    ],
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
          loginMethods: ["google", "github", "twitter"],
          supportedChains: enabledEvmChains,
          defaultChain: defaultEvmChain,
          appearance: {
            walletChainType: "ethereum-and-solana",
            showWalletLoginFirst: false,
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "all-users",
            },
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
