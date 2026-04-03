/**
 * Bags API — token launch. Requires BAGS_API_KEY.
 * Docs: https://docs.bags.fm/
 */

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";
const BAGS_TIMEOUT_MS = 6_000;

function getHeaders(): Record<string, string> {
  const key = process.env.BAGS_API_KEY;
  if (!key) throw new Error("BAGS_API_KEY not configured");
  return {
    "x-api-key": key,
    Accept: "application/json",
  };
}

export interface CreateTokenInfoParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  telegram?: string;
  twitter?: string;
  website?: string;
}

export interface CreateTokenInfoResponse {
  tokenMint: string;
  tokenMetadata: string;
}

/** Create token info and metadata. Returns tokenMint and IPFS metadata URL. */
export async function createTokenInfo(params: CreateTokenInfoParams): Promise<CreateTokenInfoResponse> {
  const form = new FormData();
  form.append("name", params.name.slice(0, 32));
  form.append("symbol", params.symbol.slice(0, 10).toUpperCase().replace("$", ""));
  form.append("description", params.description.slice(0, 1000));
  form.append("imageUrl", params.imageUrl);
  if (params.telegram?.trim()) form.append("telegram", params.telegram.trim());
  if (params.twitter?.trim()) form.append("twitter", params.twitter.trim());
  if (params.website?.trim()) form.append("website", params.website.trim());

  const headers = getHeaders();
  const res = await fetch(`${BAGS_BASE}/token-launch/create-token-info`, {
    method: "POST",
    headers: { "x-api-key": headers["x-api-key"], Accept: headers["Accept"] },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags create-token-info: ${res.status}`);
  const r = json.response ?? json;
  return { tokenMint: r.tokenMint, tokenMetadata: r.tokenMetadata };
}

const headers = () => {
  const key = process.env.BAGS_API_KEY;
  if (!key) throw new Error("BAGS_API_KEY not configured");
  return { "x-api-key": key, "Content-Type": "application/json", Accept: "application/json" };
};

/** Create fee share config. Creator gets 100%. Returns meteoraConfigKey and transactions to sign/send. */
export async function createFeeShareConfig(payer: string, baseMint: string) {
  const partner = process.env.BAGS_PARTNER_WALLET;
  const partnerConfig = process.env.BAGS_PARTNER_CONFIG_KEY;
  const body = {
    payer,
    baseMint,
    claimersArray: [payer],
    basisPointsArray: [10000],
    ...(partner && partnerConfig && { partner, partnerConfig }),
  };
  const res = await fetch(`${BAGS_BASE}/fee-share/config`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags fee-share/config: ${res.status}`);
  return json.response ?? json;
}

/** Create launch transaction. Returns base58 serialized transaction. */
export async function createLaunchTransaction(params: {
  ipfs: string;
  tokenMint: string;
  wallet: string;
  initialBuyLamports: number;
  configKey: string;
}) {
  const res = await fetch(`${BAGS_BASE}/token-launch/create-launch-transaction`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof json?.error === "string"
        ? json.error
        : json?.message ?? `Bags create-launch-transaction: ${res.status}`;
    throw new Error(errMsg);
  }
  const tx = json.response ?? json;
  return typeof tx === "string" ? tx : tx?.transaction;
}

const BAGS_GET_HEADERS = () => {
  const key = process.env.BAGS_API_KEY;
  if (!key) throw new Error("BAGS_API_KEY not configured");
  return { "x-api-key": key, Accept: "application/json" };
};

/** Token launch creators (v3). Returns array of creator info for a token. */
export async function getTokenCreators(tokenMint: string): Promise<Array<{
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider?: string | null;
  providerUsername?: string | null;
  twitterUsername?: string;
  bagsUsername?: string;
  isAdmin?: boolean;
}>> {
  const res = await fetch(
    `${BAGS_BASE}/token-launch/creator/v3?tokenMint=${encodeURIComponent(tokenMint)}`,
    { headers: BAGS_GET_HEADERS() }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags get token creators: ${res.status}`);
  const r = json.response ?? json;
  return Array.isArray(r) ? r : [];
}

/** Token claim stats: total claimed per fee claimer. */
export async function getTokenClaimStats(tokenMint: string): Promise<Array<{
  wallet: string;
  isCreator: boolean;
  totalClaimed: string;
  username?: string;
  pfp?: string;
  royaltyBps?: number;
}>> {
  const res = await fetch(
    `${BAGS_BASE}/token-launch/claim-stats?tokenMint=${encodeURIComponent(tokenMint)}`,
    { headers: BAGS_GET_HEADERS() }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags get claim stats: ${res.status}`);
  const r = json.response ?? json;
  return Array.isArray(r) ? r : [];
}

/** Bags pool info. */
export interface BagsPoolInfo {
  tokenMint: string;
  dbcConfigKey: string;
  dbcPoolKey: string;
  dammV2PoolKey?: string | null;
}

/** Get all Bags pools. */
export async function getBagsPools(onlyMigrated?: boolean): Promise<BagsPoolInfo[]> {
  const qs = onlyMigrated ? "?onlyMigrated=true" : "";
  const res = await fetch(`${BAGS_BASE}/solana/bags/pools${qs}`, {
    headers: BAGS_GET_HEADERS(),
    signal: AbortSignal.timeout(BAGS_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags get pools: ${res.status}`);
  const r = json.response ?? json;
  return Array.isArray(r) ? r : [];
}

/** Get Bags pool by token mint. Returns null if not a Bags token. */
export async function getBagsPoolByTokenMint(tokenMint: string): Promise<BagsPoolInfo | null> {
  const res = await fetch(
    `${BAGS_BASE}/solana/bags/pools/token-mint?tokenMint=${encodeURIComponent(tokenMint)}`,
    {
      headers: BAGS_GET_HEADERS(),
      signal: AbortSignal.timeout(BAGS_TIMEOUT_MS),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return null;
    throw new Error(json.error || `Bags get pool: ${res.status}`);
  }
  const r = json.response ?? json;
  return r ?? null;
}

/** Get claimable fee positions for a wallet. */
export async function getClaimablePositions(wallet: string): Promise<Array<{
  baseMint: string;
  isMigrated: boolean;
  isCustomFeeVault: boolean;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount?: number;
  virtualPoolAddress?: string | null;
  dammPoolAddress?: string | null;
  dammPositionInfo?: {
    position: string;
    pool: string;
    positionNftAccount: string;
    tokenAMint: string;
    tokenBMint: string;
    tokenAVault: string;
    tokenBVault: string;
  } | null;
  [k: string]: unknown;
}>> {
  const res = await fetch(
    `${BAGS_BASE}/token-launch/claimable-positions?wallet=${encodeURIComponent(wallet)}`,
    { headers: BAGS_GET_HEADERS() }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags get claimable positions: ${res.status}`);
  const r = json.response ?? json;
  return Array.isArray(r) ? r : [];
}

/** Get claim transactions (v3). Returns array of { tx: base58, blockhash }. */
export async function getClaimTransactionsV3(feeClaimer: string, tokenMint: string): Promise<Array<{
  tx: string;
  blockhash: { blockhash: string; lastValidBlockHeight: number };
}>> {
  const res = await fetch(`${BAGS_BASE}/token-launch/claim-txs/v3`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ feeClaimer, tokenMint }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags get claim txs v3: ${res.status}`);
  const r = json.response ?? json;
  return Array.isArray(r) ? r : [];
}

/** Get token lifetime fees (lamports as string). */
export async function getTokenLifetimeFees(tokenMint: string): Promise<string> {
  const res = await fetch(
    `${BAGS_BASE}/token-launch/lifetime-fees?tokenMint=${encodeURIComponent(tokenMint)}`,
    { headers: BAGS_GET_HEADERS() }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags lifetime fees: ${res.status}`);
  const r = json.response ?? json;
  return typeof r === "string" ? r : String(r ?? "0");
}

export interface BagsTradeQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageMode?: "auto" | "manual";
  slippageBps?: number;
}

/** Get trade quote for swapping tokens. */
export async function getBagsTradeQuote(params: BagsTradeQuoteParams) {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageMode: params.slippageMode ?? "auto",
  });
  if (params.slippageMode === "manual" && params.slippageBps != null) {
    qs.set("slippageBps", String(params.slippageBps));
  }
  const res = await fetch(`${BAGS_BASE}/trade/quote?${qs}`, {
    headers: BAGS_GET_HEADERS(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags trade quote: ${res.status}`);
  return json.response ?? json;
}

/** Create swap transaction from quote. Returns base58 transaction. */
export async function createBagsSwapTransaction(
  quoteResponse: unknown,
  userPublicKey: string
): Promise<string> {
  const res = await fetch(`${BAGS_BASE}/trade/swap`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ quoteResponse, userPublicKey }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Bags create swap: ${res.status}`);
  const r = json.response ?? json;
  return r?.swapTransaction ?? r;
}
