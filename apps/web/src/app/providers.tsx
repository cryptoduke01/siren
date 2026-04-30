"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, type ConnectionConfig } from "@solana/web3.js";
import { useEffect, useMemo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import * as solanaKit from "@solana/kit";
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

declare global {
  interface Window {
    __sirenMwaRegistered?: boolean;
  }
}

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

type BrowserSafeRpcTransport = <TResponse>(config: { payload: unknown; signal?: AbortSignal }) => Promise<TResponse>;

const createSolanaRpcFromTransport = (
  solanaKit as typeof solanaKit & {
    createSolanaRpcFromTransport?: (transport: BrowserSafeRpcTransport) => ReturnType<typeof createSolanaRpc>;
  }
).createSolanaRpcFromTransport;

function createBrowserSafeSolanaRpc(url: string) {
  if (!createSolanaRpcFromTransport) {
    return createSolanaRpc(url);
  }

  async function transport<TResponse>({ payload, signal }: { payload: unknown; signal?: AbortSignal }): Promise<TResponse> {
    const response = await fetch(url, {
      method: "POST",
      signal,
      headers: stripSolanaClientHeader({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });

    const rawResponse = await response.text();

    if (!response.ok) {
      throw new Error(rawResponse || `Solana RPC request failed (${response.status})`);
    }

    return JSON.parse(rawResponse) as TResponse;
  }

  return createSolanaRpcFromTransport(transport as BrowserSafeRpcTransport);
}

function shouldRegisterMobileWalletAdapter() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const isChromeFamily = /(Chrome|Chromium)/i.test(userAgent) && !/EdgA|OPR|Firefox/i.test(userAgent);
  return isAndroid && isChromeFamily;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => rpcUrl, []);
  const connectionConfig = useMemo<ConnectionConfig>(
    () => ({
      commitment: "confirmed",
      wsEndpoint: rpcWsUrl,
      fetchMiddleware: (info, init, next) => {
        return next(info, init ? { ...init, headers: stripSolanaClientHeader(init.headers) } : init);
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
        rpc: createBrowserSafeSolanaRpc(rpcUrl),
        rpcSubscriptions: createSolanaRpcSubscriptions(rpcWsUrl),
      },
    }),
    []
  );

  useEffect(() => {
    if (!shouldRegisterMobileWalletAdapter()) return;
    if (window.__sirenMwaRegistered) return;

    let cancelled = false;

    void import("@solana-mobile/wallet-standard-mobile")
      .then((mwa) => {
        if (cancelled || window.__sirenMwaRegistered) return;
        mwa.registerMwa({
          appIdentity: {
            name: "Siren",
            uri: window.location.origin,
            icon: "/icon.svg",
          },
          authorizationCache: mwa.createDefaultAuthorizationCache(),
          chains: window.location.hostname === "localhost" ? ["solana:devnet", "solana:mainnet"] : ["solana:mainnet"],
          chainSelector: mwa.createDefaultChainSelector(),
          onWalletNotFound: mwa.createDefaultWalletNotFoundHandler(),
        });
        window.__sirenMwaRegistered = true;
      })
      .catch(() => {
        // Ignore MWA registration failures so desktop and non-Android flows stay healthy.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
