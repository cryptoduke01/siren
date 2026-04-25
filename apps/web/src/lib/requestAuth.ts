"use client";

import bs58 from "bs58";

type WalletSigner = ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
type WalletScope = "read" | "write";

const CACHE_TTL_MS = 60_000;
const authCache = new Map<string, { timestamp: number; signature: string }>();

export function buildWalletAuthMessage({
  wallet,
  scope,
  timestamp,
}: {
  wallet: string;
  scope: WalletScope;
  timestamp: number;
}) {
  return `Siren API auth\nscope:${scope}\nwallet:${wallet}\ntimestamp:${timestamp}`;
}

async function signWalletAuth({
  wallet,
  signMessage,
  scope,
}: {
  wallet: string;
  signMessage: WalletSigner;
  scope: WalletScope;
}) {
  if (!wallet || !signMessage) {
    throw new Error("Wallet signature is required for this action.");
  }

  const normalizedWallet = wallet.trim();
  const cacheKey = `${normalizedWallet}:${scope}`;
  const cached = authCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { wallet: normalizedWallet, scope, timestamp: cached.timestamp, signature: cached.signature };
  }

  const message = buildWalletAuthMessage({ wallet: normalizedWallet, scope, timestamp: now });
  const signatureBytes = await signMessage(new TextEncoder().encode(message));
  const signature = bs58.encode(signatureBytes);
  const signed = { wallet: normalizedWallet, scope, timestamp: now, signature };
  authCache.set(cacheKey, { timestamp: now, signature });
  return signed;
}

export async function getWalletAuthHeaders({
  wallet,
  signMessage,
  scope,
}: {
  wallet: string;
  signMessage: WalletSigner;
  scope: WalletScope;
}): Promise<Record<string, string>> {
  const auth = await signWalletAuth({ wallet, signMessage, scope });
  return {
    "x-siren-wallet": auth.wallet,
    "x-siren-scope": auth.scope,
    "x-siren-timestamp": String(auth.timestamp),
    "x-siren-signature": auth.signature,
  };
}

export async function appendWalletAuthQuery(
  url: URL,
  options: { wallet: string; signMessage: WalletSigner; scope: WalletScope },
) {
  const auth = await signWalletAuth(options);
  url.searchParams.set("walletAuth", auth.wallet);
  url.searchParams.set("scope", auth.scope);
  url.searchParams.set("timestamp", String(auth.timestamp));
  url.searchParams.set("signature", auth.signature);
  return url;
}

export function getSupabaseAuthHeaders(accessToken: string | null | undefined): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function getAdminPasscodeHeaders(passcode: string): Record<string, string> {
  return passcode.trim() ? { "x-siren-admin-passcode": passcode.trim() } : {};
}
