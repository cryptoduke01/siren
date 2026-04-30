/**
 * DFlow official prediction positions — wallet balances + Metadata API
 * (filter_outcome_mints + markets/batch). See:
 * https://dflow.mintlify.app/build/recipes/prediction-markets/track-positions
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { DflowPositionRow } from "@siren/shared";

const METADATA_URL = process.env.DFLOW_METADATA_API_URL || "https://dev-prediction-markets-api.dflow.net";
const DFLOW_API_KEY = process.env.DFLOW_API_KEY || "";
const POSITION_CACHE_TTL_MS = 3 * 60 * 1000;

type CachedWalletPositions = {
  positions: DflowPositionRow[];
  updatedAt: string;
};

const walletPositionCache = new Map<string, CachedWalletPositions>();

type DflowBatchAccountInfo = {
  yesMint?: string;
  noMint?: string;
  isInitialized?: boolean;
  title?: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
};

type DflowBatchMarket = {
  ticker: string;
  title: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  eventTicker?: string;
  seriesTicker?: string;
  yesBid?: string;
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  openTime?: number;
  closeTime?: number;
  status?: string;
  accounts?: Record<string, DflowBatchAccountInfo>;
};

type DflowOutcomeMintMetadata = {
  mint: string;
  side: "yes" | "no";
  ticker: string;
  title: string;
  eventTicker?: string;
  seriesTicker?: string;
  yesBid?: string;
  yesAsk?: string;
  closeTime?: number;
  marketStatus?: string;
  outcomeLabel?: string | null;
  currentPriceUsd?: number;
  kalshi_url?: string;
};

function metadataHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DFLOW_API_KEY) h["x-api-key"] = DFLOW_API_KEY;
  return h;
}

function kalshiUrlFromMarket(m: {
  ticker: string;
  title: string;
  eventTicker?: string;
  seriesTicker?: string;
}): string {
  const seriesTicker = m.seriesTicker ?? m.eventTicker?.split("-").slice(0, -1).join("-") ?? "";
  const seriesSlug = seriesTicker.toLowerCase();
  const marketTickerSlug = m.ticker.toLowerCase();
  const titleSlug = (m.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return titleSlug
    ? `https://kalshi.com/markets/${seriesSlug}/${titleSlug}/${marketTickerSlug}`
    : `https://kalshi.com/markets/${seriesSlug}/${marketTickerSlug}`;
}

interface ParsedTokenAmount {
  mint: string;
  balance: number;
  decimals: number;
}

function normalizeTimestampMs(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value < 1_000_000_000_000 ? Math.round(value * 1000) : Math.round(value);
}

function normalizeLabelText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function isGenericOutcomeLabel(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return (
    !lower ||
    lower === "yes" ||
    lower === "no" ||
    lower === "outcome" ||
    lower === "market" ||
    lower === "default" ||
    lower === "main" ||
    lower === "option" ||
    lower === "up" ||
    lower === "down" ||
    /^[0-9]+$/.test(lower)
  );
}

function buildOutcomeLabel(
  side: "yes" | "no",
  market: DflowBatchMarket,
  accountKey?: string,
): string {
  const preferred = [
    side === "yes" ? market.yesSubTitle : market.noSubTitle,
    accountKey,
    market.subtitle,
  ]
    .map((value) => normalizeLabelText(value))
    .find((value) => value && !isGenericOutcomeLabel(value));

  if (preferred) return preferred;
  return side.toUpperCase();
}

function computeYesProbabilityPct(market: Pick<DflowBatchMarket, "yesBid" | "yesAsk">): number {
  const yesBid = market.yesBid ? parseFloat(market.yesBid) : undefined;
  const yesAsk = market.yesAsk ? parseFloat(market.yesAsk) : undefined;
  const rawProb = yesBid ?? yesAsk ?? 50;
  let probPct = Number.isFinite(rawProb) ? rawProb : 50;
  if (probPct > 0 && probPct <= 1) probPct *= 100;
  return Math.min(100, Math.max(0, probPct));
}

async function fetchDflowBatchMarkets(mints: string[]): Promise<DflowBatchMarket[]> {
  const uniqueMints = [...new Set(mints.map((mint) => mint.trim()).filter(Boolean))];
  if (uniqueMints.length === 0) return [];

  const batchRes = await fetch(`${METADATA_URL}/api/v1/markets/batch`, {
    method: "POST",
    headers: metadataHeaders(),
    body: JSON.stringify({ mints: uniqueMints }),
  });
  if (!batchRes.ok) {
    const text = await batchRes.text();
    throw new Error(`markets/batch ${batchRes.status}: ${text.slice(0, 240)}`);
  }

  const batchJson = (await batchRes.json()) as { markets?: DflowBatchMarket[] };
  return batchJson.markets ?? [];
}

export async function getDflowOutcomeMintMetadata(mints: string[]): Promise<Map<string, DflowOutcomeMintMetadata>> {
  const markets = await fetchDflowBatchMarkets(mints);
  const metadataByMint = new Map<string, DflowOutcomeMintMetadata>();

  for (const market of markets) {
    const accounts = market.accounts ? Object.entries(market.accounts) : [];
    const probabilityPct = computeYesProbabilityPct(market);
    for (const [accountKey, account] of accounts) {
      const shared = {
        ticker: market.ticker,
        title: market.title,
        eventTicker: market.eventTicker,
        seriesTicker: market.seriesTicker,
        yesBid: market.yesBid,
        yesAsk: market.yesAsk,
        closeTime: normalizeTimestampMs(market.closeTime),
        marketStatus: market.status,
        kalshi_url: kalshiUrlFromMarket(market),
      } satisfies Omit<DflowOutcomeMintMetadata, "mint" | "side" | "outcomeLabel" | "currentPriceUsd">;

      const yesOutcomeLabel = buildOutcomeLabel("yes", market, accountKey);
      if (account.yesMint) {
        metadataByMint.set(account.yesMint, {
          mint: account.yesMint,
          side: "yes",
          ...shared,
          outcomeLabel: yesOutcomeLabel,
          currentPriceUsd: probabilityPct / 100,
        });
      }
      if (account.noMint) {
        metadataByMint.set(account.noMint, {
          mint: account.noMint,
          side: "no",
          ...shared,
          outcomeLabel:
            normalizeLabelText(market.noSubTitle) ||
            (yesOutcomeLabel !== "YES" ? `Not ${yesOutcomeLabel}` : "NO"),
          currentPriceUsd: (100 - probabilityPct) / 100,
        });
      }
    }
  }

  return metadataByMint;
}

function collectWalletTokens(connection: Connection, owner: PublicKey): Promise<ParsedTokenAmount[]> {
  return Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]).then(([spl, t2022]) => {
    const byMint = new Map<string, ParsedTokenAmount>();
    for (const { account } of [...spl.value, ...t2022.value]) {
      const data = account.data as {
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: { uiAmount: number | null; decimals: number };
          };
        };
      };
      const info = data.parsed?.info;
      if (!info?.mint || info.tokenAmount?.uiAmount == null || info.tokenAmount.uiAmount <= 0) continue;
      const mint = info.mint;
      const balance = info.tokenAmount.uiAmount;
      const decimals = info.tokenAmount.decimals ?? 6;
      const prev = byMint.get(mint);
      if (!prev || balance > prev.balance) {
        byMint.set(mint, { mint, balance, decimals });
      }
    }
    return [...byMint.values()];
  });
}

export async function getDflowPositionsForWallet(walletAddress: string): Promise<{
  positions: DflowPositionRow[];
  error?: string;
  stale?: boolean;
  updatedAt?: string;
  degradedReason?: string;
}> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(walletAddress);
  } catch {
    return { positions: [], error: "Invalid wallet address" };
  }

  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  let tokens: ParsedTokenAmount[];
  try {
    tokens = await collectWalletTokens(connection, owner);
  } catch (e) {
    const message = `RPC token accounts failed: ${(e as Error).message}`;
    const cached = walletPositionCache.get(walletAddress);
    if (cached && Date.now() - Date.parse(cached.updatedAt) <= POSITION_CACHE_TTL_MS) {
      return {
        positions: cached.positions,
        stale: true,
        updatedAt: cached.updatedAt,
        degradedReason: message,
      };
    }
    return { positions: [], error: message };
  }

  if (tokens.length === 0) {
    const updatedAt = new Date().toISOString();
    walletPositionCache.set(walletAddress, { positions: [], updatedAt });
    return { positions: [], updatedAt };
  }

  const addresses = tokens.map((t) => t.mint);
  let outcomeMints: string[];
  try {
    const filterRes = await fetch(`${METADATA_URL}/api/v1/filter_outcome_mints`, {
      method: "POST",
      headers: metadataHeaders(),
      body: JSON.stringify({ addresses }),
    });
    if (!filterRes.ok) {
      const t = await filterRes.text();
      return { positions: [], error: `filter_outcome_mints ${filterRes.status}: ${t.slice(0, 240)}` };
    }
    const filterJson = (await filterRes.json()) as { outcomeMints?: string[] };
    outcomeMints = filterJson.outcomeMints ?? [];
  } catch (e) {
    return { positions: [], error: `filter_outcome_mints: ${(e as Error).message}` };
  }

  if (outcomeMints.length === 0) {
    const updatedAt = new Date().toISOString();
    walletPositionCache.set(walletAddress, { positions: [], updatedAt });
    return { positions: [], updatedAt };
  }

  const outcomeTokens = tokens.filter((t) => outcomeMints.includes(t.mint));
  if (outcomeTokens.length === 0) {
    const updatedAt = new Date().toISOString();
    walletPositionCache.set(walletAddress, { positions: [], updatedAt });
    return { positions: [], updatedAt };
  }

  try {
    const metadataByMint = await getDflowOutcomeMintMetadata(outcomeTokens.map((t) => t.mint));
    const positions: DflowPositionRow[] = [];

    for (const token of outcomeTokens) {
      const metadata = metadataByMint.get(token.mint);
      if (!metadata) continue;

      const qty = token.balance;
      const currentPriceUsd = metadata.currentPriceUsd;
      const marketValueUsd =
        typeof currentPriceUsd === "number" && Number.isFinite(currentPriceUsd) && Number.isFinite(qty)
          ? qty * currentPriceUsd
          : undefined;

      positions.push({
        mint: token.mint,
        balance: token.balance,
        decimals: token.decimals,
        side: metadata.side,
        ticker: metadata.ticker,
        title: metadata.title,
        eventTicker: metadata.eventTicker,
        seriesTicker: metadata.seriesTicker,
        kalshi_url: metadata.kalshi_url,
        probability: computeYesProbabilityPct({ yesBid: metadata.yesBid, yesAsk: metadata.yesAsk }),
        yesBid: metadata.yesBid,
        yesAsk: metadata.yesAsk,
        quantity: qty,
        currentPriceUsd,
        currentPrice: currentPriceUsd != null ? Number((currentPriceUsd * 100).toFixed(4)) : undefined,
        marketValueUsd,
        closeTime: metadata.closeTime,
        marketStatus: metadata.marketStatus,
        outcomeLabel: metadata.outcomeLabel,
        verified: true,
      });
    }

    const updatedAt = new Date().toISOString();
    walletPositionCache.set(walletAddress, { positions, updatedAt });
    return { positions, updatedAt };
  } catch (e) {
    return { positions: [], error: `markets/batch: ${(e as Error).message}` };
  }
}
