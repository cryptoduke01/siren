const GOLDRUSH_BASE = "https://api.covalenthq.com/v1/solana-mainnet/address";
const GOLDRUSH_TIMEOUT_MS = 8_000;
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "USDS", "USDE", "PYUSD", "USDY"]);

type GoldRushBalanceResponse = {
  address?: string;
  quote_currency?: string;
  updated_at?: string;
  items?: Array<{
    contract_name?: string;
    contract_ticker_symbol?: string;
    contract_address?: string;
    contract_decimals?: number;
    is_native_token?: boolean;
    is_spam?: boolean;
    balance?: string;
    quote?: number;
    pretty_quote?: string;
    logo_urls?: {
      token_logo_url?: string;
    };
  }>;
};

export type GoldRushHolding = {
  symbol: string;
  name: string;
  quoteUsd: number;
  prettyQuote: string | null;
  balance: string;
  decimals: number;
  contractAddress: string | null;
  logoUrl: string | null;
  isStable: boolean;
  isNative: boolean;
};

export type GoldRushWalletIntelligence = {
  wallet: string;
  quoteCurrency: string;
  updatedAt: string | null;
  summary: {
    tokenCount: number;
    stablecoinUsd: number;
    nativeSolUsd: number;
    totalQuotedUsd: number;
    concentrationPct: number;
  };
  holdings: GoldRushHolding[];
  narrative: {
    reserveRead: string;
    concentrationRead: string;
    readiness: string;
  };
};

function formatUsdWhole(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseQuote(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getGoldRushWalletIntelligence(wallet: string): Promise<GoldRushWalletIntelligence> {
  const apiKey = process.env.GOLDRUSH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GoldRush API key not configured. Add GOLDRUSH_API_KEY to apps/api/.env (see .env.example).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOLDRUSH_TIMEOUT_MS);
  const url = new URL(`${GOLDRUSH_BASE}/${encodeURIComponent(wallet)}/balances_v2/`);
  url.searchParams.set("no-spam", "true");
  url.searchParams.set("quote-currency", "USD");

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GoldRush balances failed (${res.status})`);
    }

    const payload = (await res.json()) as GoldRushBalanceResponse;
    const holdings = (payload.items ?? [])
      .filter((item) => !item.is_spam)
      .map((item) => {
        const symbol = item.contract_ticker_symbol?.trim() || "UNKNOWN";
        return {
          symbol,
          name: item.contract_name?.trim() || symbol,
          quoteUsd: parseQuote(item.quote),
          prettyQuote: item.pretty_quote?.trim() || null,
          balance: item.balance?.trim() || "0",
          decimals: typeof item.contract_decimals === "number" ? item.contract_decimals : 0,
          contractAddress: item.contract_address?.trim() || null,
          logoUrl: item.logo_urls?.token_logo_url?.trim() || null,
          isStable: STABLECOIN_SYMBOLS.has(symbol.toUpperCase()),
          isNative: Boolean(item.is_native_token),
        };
      })
      .sort((left, right) => right.quoteUsd - left.quoteUsd);

    const totalQuotedUsd = holdings.reduce((sum, holding) => sum + holding.quoteUsd, 0);
    const stablecoinUsd = holdings.filter((holding) => holding.isStable).reduce((sum, holding) => sum + holding.quoteUsd, 0);
    const nativeSolUsd = holdings.filter((holding) => holding.isNative).reduce((sum, holding) => sum + holding.quoteUsd, 0);
    const topHoldingUsd = holdings[0]?.quoteUsd ?? 0;
    const concentrationPct = totalQuotedUsd > 0 ? Number(((topHoldingUsd / totalQuotedUsd) * 100).toFixed(1)) : 0;

    const reserveRead =
      stablecoinUsd > 0
        ? `${formatUsdWhole(stablecoinUsd)} of stablecoin balance is sitting idle on-chain, which is usable dry powder for faster prediction execution.`
        : "No meaningful stablecoin reserve is visible on-chain right now, so fresh deposits may be needed before larger clips.";

    const concentrationRead =
      concentrationPct >= 60
        ? `One holding dominates about ${concentrationPct}% of visible wallet value. That can distort risk readiness if you size prediction trades off headline wallet value alone.`
        : `Wallet concentration looks manageable, with the largest holding at about ${concentrationPct}% of visible wallet value.`;

    const readiness =
      stablecoinUsd >= 100
        ? "Wallet looks funded enough for live route testing, clip probing, and controlled execution sizing."
        : "Wallet intelligence is live, but the visible reserve looks light for repeated live route tests.";

    return {
      wallet,
      quoteCurrency: payload.quote_currency?.trim() || "USD",
      updatedAt: payload.updated_at?.trim() || null,
      summary: {
        tokenCount: holdings.length,
        stablecoinUsd: Number(stablecoinUsd.toFixed(2)),
        nativeSolUsd: Number(nativeSolUsd.toFixed(2)),
        totalQuotedUsd: Number(totalQuotedUsd.toFixed(2)),
        concentrationPct,
      },
      holdings: holdings.slice(0, 5),
      narrative: {
        reserveRead,
        concentrationRead,
        readiness,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
