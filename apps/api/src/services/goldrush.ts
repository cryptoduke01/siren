const GOLDRUSH_BASE = "https://api.covalenthq.com/v1/solana-mainnet/address";
const GOLDRUSH_TIMEOUT_MS = 8_000;
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "USDS", "USDE", "PYUSD", "USDY"]);

type GoldRushBalanceResponse = {
  data?: {
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
};

type GoldRushTransactionsResponse = {
  data?: {
    updated_at?: string;
    items?: Array<{
      block_signed_at?: string;
      tx_hash?: string;
      successful?: boolean;
      from_address?: string;
      to_address?: string;
      value_quote?: number;
      pretty_value_quote?: string;
      fees_paid?: string;
      gas_quote?: number;
      explorers?: Array<{
        label?: string;
        url?: string;
      }>;
    }>;
  };
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

export type GoldRushActivityItem = {
  txHash: string;
  timestamp: string | null;
  direction: "in" | "out" | "self" | "unknown";
  valueUsd: number;
  prettyValueUsd: string | null;
  successful: boolean;
  explorerUrl: string | null;
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
    riskScore: number;
    riskLabel: "low" | "moderate" | "high";
    recentTxnCount: number;
    inboundUsd: number;
    outboundUsd: number;
    lastActiveAt: string | null;
  };
  alerts: Array<{
    level: "info" | "warn" | "high";
    label: string;
    summary: string;
  }>;
  holdings: GoldRushHolding[];
  activity: GoldRushActivityItem[];
  narrative: {
    reserveRead: string;
    concentrationRead: string;
    readiness: string;
    activityRead: string;
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

function getAuthToken(): string {
  const apiKey = process.env.GOLDRUSH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GoldRush API key not configured. Add GOLDRUSH_API_KEY to apps/api/.env (see .env.example).");
  }
  return apiKey;
}

async function fetchGoldRushJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOLDRUSH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GoldRush request failed (${res.status})`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDirection(wallet: string, from?: string | null, to?: string | null): GoldRushActivityItem["direction"] {
  const normalizedWallet = wallet.toLowerCase();
  const normalizedFrom = from?.toLowerCase();
  const normalizedTo = to?.toLowerCase();

  if (normalizedFrom === normalizedWallet && normalizedTo === normalizedWallet) return "self";
  if (normalizedTo === normalizedWallet) return "in";
  if (normalizedFrom === normalizedWallet) return "out";
  return "unknown";
}

export async function getGoldRushWalletIntelligence(wallet: string): Promise<GoldRushWalletIntelligence> {
  getAuthToken();

  const balancesUrl = new URL(`${GOLDRUSH_BASE}/${encodeURIComponent(wallet)}/balances_v2/`);
  balancesUrl.searchParams.set("no-spam", "true");
  balancesUrl.searchParams.set("quote-currency", "USD");

  const transactionsUrl = new URL(`${GOLDRUSH_BASE}/${encodeURIComponent(wallet)}/transactions_v3/`);
  transactionsUrl.searchParams.set("quote-currency", "USD");
  transactionsUrl.searchParams.set("no-logs", "true");

  const [balancesPayload, transactionsPayload] = await Promise.all([
    fetchGoldRushJson<GoldRushBalanceResponse>(balancesUrl),
    fetchGoldRushJson<GoldRushTransactionsResponse>(transactionsUrl).catch(
      () => ({ data: { items: [] } }) as GoldRushTransactionsResponse,
    ),
  ]);

  const holdings = (balancesPayload.data?.items ?? [])
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

  const activity = (transactionsPayload.data?.items ?? [])
    .slice(0, 8)
    .map((item) => {
      const direction = normalizeDirection(wallet, item.from_address, item.to_address);
      return {
        txHash: item.tx_hash?.trim() || "unknown",
        timestamp: item.block_signed_at?.trim() || null,
        direction,
        valueUsd: parseQuote(item.value_quote),
        prettyValueUsd: item.pretty_value_quote?.trim() || null,
        successful: item.successful !== false,
        explorerUrl: item.explorers?.[0]?.url?.trim() || null,
      } satisfies GoldRushActivityItem;
    });

  const totalQuotedUsd = holdings.reduce((sum, holding) => sum + holding.quoteUsd, 0);
  const stablecoinUsd = holdings.filter((holding) => holding.isStable).reduce((sum, holding) => sum + holding.quoteUsd, 0);
  const nativeSolUsd = holdings.filter((holding) => holding.isNative).reduce((sum, holding) => sum + holding.quoteUsd, 0);
  const topHoldingUsd = holdings[0]?.quoteUsd ?? 0;
  const concentrationPct = totalQuotedUsd > 0 ? Number(((topHoldingUsd / totalQuotedUsd) * 100).toFixed(1)) : 0;
  const inboundUsd = Number(activity.filter((row) => row.direction === "in").reduce((sum, row) => sum + row.valueUsd, 0).toFixed(2));
  const outboundUsd = Number(activity.filter((row) => row.direction === "out").reduce((sum, row) => sum + row.valueUsd, 0).toFixed(2));
  const lastActiveAt = activity[0]?.timestamp ?? null;
  const alerts: GoldRushWalletIntelligence["alerts"] = [];

  if (stablecoinUsd < 25) {
    alerts.push({
      level: "warn",
      label: "Low stable reserve",
      summary: "Visible stablecoin balance is light, which limits fast clip testing and reactive execution sizing.",
    });
  }

  if (nativeSolUsd < 10) {
    alerts.push({
      level: "warn",
      label: "Thin SOL runway",
      summary: "Native SOL balance looks light for repeated routing attempts and network fee buffers.",
    });
  }

  if (concentrationPct >= 60) {
    alerts.push({
      level: "high",
      label: "Concentrated wallet",
      summary: "One holding dominates visible wallet value, so headline balance overstates flexible execution capital.",
    });
  } else if (concentrationPct >= 35) {
    alerts.push({
      level: "info",
      label: "Moderate concentration",
      summary: "A single holding still carries a meaningful share of wallet value, so sizing should stay aware of concentration drift.",
    });
  }

  if (!lastActiveAt) {
    alerts.push({
      level: "info",
      label: "Quiet wallet",
      summary: "No recent on-chain flow was detected in GoldRush recent activity, so wallet state may be idle rather than execution-ready.",
    });
  } else if (outboundUsd >= 100 && outboundUsd > inboundUsd * 1.5) {
    alerts.push({
      level: "warn",
      label: "Recent capital outflow",
      summary: "Recent outflows dominate inflows, so visible balance may already be drifting away from what your last execution session assumed.",
    });
  } else if (inboundUsd >= 100) {
    alerts.push({
      level: "info",
      label: "Fresh funding flow",
      summary: "Recent inbound flow suggests new on-chain capital that may be deployable for execution if venue balances are in place.",
    });
  }

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (concentrationPct >= 60 ? 34 : concentrationPct >= 35 ? 18 : 6) +
          (stablecoinUsd < 25 ? 24 : stablecoinUsd < 100 ? 12 : 4) +
          (nativeSolUsd < 10 ? 18 : nativeSolUsd < 25 ? 8 : 2) +
          (outboundUsd >= 100 && outboundUsd > inboundUsd * 1.5 ? 16 : !lastActiveAt ? 8 : 2),
      ),
    ),
  );
  const riskLabel: GoldRushWalletIntelligence["summary"]["riskLabel"] =
    riskScore >= 65 ? "high" : riskScore >= 35 ? "moderate" : "low";

  const reserveRead =
    stablecoinUsd > 0
      ? `${formatUsdWhole(stablecoinUsd)} of stablecoin balance is sitting idle on-chain, which is usable dry powder for faster prediction execution.`
      : "No meaningful stablecoin reserve is visible on-chain right now, so fresh deposits may be needed before larger clips.";

  const concentrationRead =
    concentrationPct >= 60
      ? `One holding dominates about ${concentrationPct}% of visible wallet value. That can distort risk readiness if you size prediction trades off headline wallet value alone.`
      : `Wallet concentration looks manageable, with the largest holding at about ${concentrationPct}% of visible wallet value.`;

  const readiness =
    stablecoinUsd >= 100 && nativeSolUsd >= 10
      ? "Wallet looks funded enough for live route testing, clip probing, and controlled execution sizing."
      : "Wallet intelligence is live, but the visible reserve still looks light for repeated live route tests.";

  const activityRead =
    !lastActiveAt
      ? "Recent transaction flow is quiet, so Siren should rely more on current balances than on fresh activity patterns."
      : outboundUsd > inboundUsd
        ? `Recent outbound flow is ahead of inbound flow by about ${formatUsdWhole(Math.max(0, outboundUsd - inboundUsd))}, which can lower real execution readiness faster than balances alone suggest.`
        : inboundUsd > 0
          ? `Recent inbound flow adds about ${formatUsdWhole(inboundUsd)} of visible on-chain activity, which is a healthier setup for testing and routing fresh clips.`
          : "Recent wallet activity is live, but net flow is still small enough that balances remain the stronger execution signal.";

  return {
    wallet,
    quoteCurrency: balancesPayload.data?.quote_currency?.trim() || "USD",
    updatedAt: balancesPayload.data?.updated_at?.trim() || transactionsPayload.data?.updated_at?.trim() || null,
    summary: {
      tokenCount: holdings.length,
      stablecoinUsd: Number(stablecoinUsd.toFixed(2)),
      nativeSolUsd: Number(nativeSolUsd.toFixed(2)),
      totalQuotedUsd: Number(totalQuotedUsd.toFixed(2)),
      concentrationPct,
      riskScore,
      riskLabel,
      recentTxnCount: activity.length,
      inboundUsd,
      outboundUsd,
      lastActiveAt,
    },
    alerts,
    holdings: holdings.slice(0, 5),
    activity: activity.slice(0, 5),
    narrative: {
      reserveRead,
      concentrationRead,
      readiness,
      activityRead,
    },
  };
}
