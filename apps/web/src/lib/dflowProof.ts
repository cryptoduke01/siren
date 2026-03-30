import bs58 from "bs58";

export const DFLOW_PROOF_PORTAL_URL = "https://dflow.net/proof";

export function buildProofMessage(timestamp: number): string {
  return `Proof KYC verification: ${timestamp}`;
}

export function encodeProofSignature(signature: Uint8Array | string): string {
  if (typeof signature === "string") {
    return signature;
  }
  return bs58.encode(signature);
}

export function buildProofRedirectUri(baseRedirectUri: string, wallet: string): string {
  const url = new URL(baseRedirectUri);
  url.searchParams.set("wallet", wallet);
  return url.toString();
}

export function buildProofDeepLink({
  wallet,
  signature,
  timestamp,
  redirectUri,
}: {
  wallet: string;
  signature: string;
  timestamp: number;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    wallet,
    signature,
    timestamp: String(timestamp),
    redirect_uri: redirectUri,
  });

  return `${DFLOW_PROOF_PORTAL_URL}?${params.toString()}`;
}
