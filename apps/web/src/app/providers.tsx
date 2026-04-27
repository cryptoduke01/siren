"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, type ConnectionConfig } from "@solana/web3.js";
import { useMemo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { PrivyWalletBridge } from "@/contexts/SirenWalletContext";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  clusterApiUrl("mainnet-beta");

const rpcWsUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_WS_URL ||
  rpcUrl
    .replace("https://", "wss://")
    .replace("http://", "ws://");
const privyLogoUrl = "https://onsiren.xyz/brand/privy-wordmark.png";

function stripSolanaClientHeader(headers?: HeadersInit): HeadersInit | undefined {
  if (!headers) return headers;
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.delete("solana-client");
    return next;
  }
  if (Array.isArray(headers)) {
    return headers.filter(([key]) => key.toLowerCase() !== "solana-client");
  }

  const next = { ...headers };
  delete next["solana-client"];
  delete next["Solana-Client"];
  return next;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => rpcUrl, []);
  const connectionConfig = useMemo<ConnectionConfig>(
    () => ({
      commitment: "confirmed",
      wsEndpoint: rpcWsUrl,
      fetchMiddleware: (info, init, next) => {
        next(info, init ? { ...init, headers: stripSolanaClientHeader(init.headers) } : init);
      },
    }),
    []
  );
  const wallets = useMemo(
    () => [new TorusWalletAdapter()],
    []
  );

  const solanaRpcs = useMemo(
    () => ({
      "solana:mainnet": {
        rpc: createSolanaRpc(rpcUrl),
        rpcSubscriptions: createSolanaRpcSubscriptions(rpcWsUrl),
      },
    }),
    []
  );

  const content = (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
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
          loginMethods: ["email", "google", "github"],
          appearance: {
            walletChainType: "solana-only",
            showWalletLoginFirst: false,
            logo: privyLogoUrl,
          },
          solana: {
            rpcs: solanaRpcs,
          },
          embeddedWallets: {
            solana: {
              createOnLogin: "all-users",
            },
          },
          externalWallets: {
            solana: {
              connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }),
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
