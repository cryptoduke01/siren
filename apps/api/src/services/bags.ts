/**
 * Bags API — token launch. Requires BAGS_API_KEY.
 * Docs: https://docs.bags.fm/
 */

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";

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
