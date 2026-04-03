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
}> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(walletAddress);
  } catch {
    return { positions: [], error: "Invalid wallet address" };
  }

  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  let tokens: ParsedTokenAmount[];
  try {
    tokens = await collectWalletTokens(connection, owner);
  } catch (e) {
    return { positions: [], error: `RPC token accounts failed: ${(e as Error).message}` };
  }

  if (tokens.length === 0) return { positions: [] };

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

  if (outcomeMints.length === 0) return { positions: [] };

  const outcomeTokens = tokens.filter((t) => outcomeMints.includes(t.mint));
  if (outcomeTokens.length === 0) return { positions: [] };

  let markets: Array<{
    ticker: string;
    title: string;
    eventTicker?: string;
    seriesTicker?: string;
    yesBid?: string;
    yesAsk?: string;
    accounts?: Record<string, { yesMint?: string; noMint?: string }>;
  }>;

  try {
    const batchRes = await fetch(`${METADATA_URL}/api/v1/markets/batch`, {
      method: "POST",
      headers: metadataHeaders(),
      body: JSON.stringify({ mints: outcomeTokens.map((t) => t.mint) }),
    });
    if (!batchRes.ok) {
      const t = await batchRes.text();
      return { positions: [], error: `markets/batch ${batchRes.status}: ${t.slice(0, 240)}` };
    }
    const batchJson = (await batchRes.json()) as { markets?: typeof markets };
    markets = batchJson.markets ?? [];
  } catch (e) {
    return { positions: [], error: `markets/batch: ${(e as Error).message}` };
  }

  const marketsByMint = new Map<
    string,
    {
      market: (typeof markets)[0];
      side: "yes" | "no";
    }
  >();

  for (const market of markets) {
    const accounts = market.accounts ? Object.values(market.accounts) : [];
    for (const account of accounts) {
      if (account.yesMint) marketsByMint.set(account.yesMint, { market, side: "yes" });
      if (account.noMint) marketsByMint.set(account.noMint, { market, side: "no" });
    }
  }

  const positions: DflowPositionRow[] = [];
  for (const token of outcomeTokens) {
    const mapped = marketsByMint.get(token.mint);
    if (!mapped) continue;
    const { market, side } = mapped;
    const yesBid = market.yesBid ? parseFloat(market.yesBid) : undefined;
    const yesAsk = market.yesAsk ? parseFloat(market.yesAsk) : undefined;
    const probability = yesBid ?? yesAsk ?? 50;

    positions.push({
      mint: token.mint,
      balance: token.balance,
      decimals: token.decimals,
      side,
      ticker: market.ticker,
      title: market.title,
      eventTicker: market.eventTicker,
      seriesTicker: market.seriesTicker,
      kalshi_url: kalshiUrlFromMarket(market),
      probability,
      verified: true,
    });
  }

  return { positions };
}
