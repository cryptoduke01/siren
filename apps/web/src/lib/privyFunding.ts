import { SUPPORTED_CHAINS, type FundWalletConfig } from "@privy-io/react-auth";
import type { SolanaFundingConfig } from "@privy-io/react-auth/solana";

function getEvmChain(chainId: number) {
  return SUPPORTED_CHAINS.find((chain) => Number(chain.id) === chainId);
}

export const BASE_CHAIN = getEvmChain(8453);
export const POLYGON_CHAIN = getEvmChain(137);

export function buildSolanaFundingConfig(amount = "25"): SolanaFundingConfig {
  return {
    chain: "solana:mainnet",
    amount,
    asset: "USDC",
    defaultFundingMethod: "card",
    card: {
      preferredProvider: "moonpay",
    },
    uiConfig: {
      landing: {
        title: "Add Solana USDC",
      },
      receiveFundsTitle: "Add Solana USDC to your Siren wallet",
      receiveFundsSubtitle: "Use card, Apple Pay when available, or any supported funding path inside Privy. Keep a little SOL for network fees.",
    },
  };
}

export function buildBaseFundingConfig(amount = "50"): FundWalletConfig {
  return {
    chain: BASE_CHAIN,
    amount,
    asset: "native-currency",
    defaultFundingMethod: "card",
    card: {
      preferredProvider: "moonpay",
    },
    uiConfig: {
      landing: {
        title: "Add Base ETH",
      },
      receiveFundsTitle: "Add funds on Base",
      receiveFundsSubtitle: "Use card, Apple Pay when available, or a supported wallet transfer.",
    },
  };
}

export function buildPolymarketFundingConfig(amount = "50"): FundWalletConfig {
  return {
    chain: POLYGON_CHAIN,
    amount,
    asset: "USDC",
    defaultFundingMethod: "card",
    card: {
      preferredProvider: "moonpay",
    },
    uiConfig: {
      landing: {
        title: "Fund Polymarket",
      },
      receiveFundsTitle: "Add Polygon USDC for Polymarket",
      receiveFundsSubtitle: "Use card, Apple Pay when available, or a supported deposit path. Siren trades Polymarket from this balance.",
    },
  };
}
