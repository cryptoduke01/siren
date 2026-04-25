"use client";

import bs58 from "bs58";

type WalletSigner = ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
type WalletScope = "read" | "write";

const CACHE_TTL_MS = 10 * 60 * 60 * 1000;
const STORAGE_KEY = "siren.wallet-auth.v1";
const authCache = new Map<string, { wallet: string; scope: WalletScope; timestamp: number; signature: string }>();

function getCacheKey(wallet: string, scope: WalletScope): string {
  return `${wallet}:${scope}`;
}

function isFreshAuth(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

function readStoredAuthEntries() {
  if (typeof window === "undefined") return [] as Array<{ wallet: string; scope: WalletScope; timestamp: number; signature: string }>;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is { wallet: string; scope: WalletScope; timestamp: number; signature: string } => {
      if (!entry || typeof entry !== "object") return false;
      const wallet = "wallet" in entry ? entry.wallet : undefined;
      const scope = "scope" in entry ? entry.scope : undefined;
      const timestamp = "timestamp" in entry ? entry.timestamp : undefined;
      const signature = "signature" in entry ? entry.signature : undefined;
      return (
        typeof wallet === "string" &&
        (scope === "read" || scope === "write") &&
        typeof timestamp === "number" &&
        Number.isFinite(timestamp) &&
        typeof signature === "string" &&
        isFreshAuth(timestamp)
      );
    });
  } catch {
    return [];
  }
}

function writeStoredAuthEntries(entries: Array<{ wallet: string; scope: WalletScope; timestamp: number; signature: string }>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter((entry) => isFreshAuth(entry.timestamp))));
  } catch {
    /* ignore storage failures */
  }
}

function persistAuthEntry(entry: { wallet: string; scope: WalletScope; timestamp: number; signature: string }) {
  authCache.set(getCacheKey(entry.wallet, entry.scope), entry);
  const next = readStoredAuthEntries().filter((cached) => !(cached.wallet === entry.wallet && cached.scope === entry.scope));
  next.push(entry);
  writeStoredAuthEntries(next);
}

function getCachedAuth(wallet: string, requestedScope: WalletScope) {
  const candidateScopes: WalletScope[] = requestedScope === "read" ? ["write", "read"] : ["write"];

  for (const scope of candidateScopes) {
    const cached = authCache.get(getCacheKey(wallet, scope));
    if (cached && isFreshAuth(cached.timestamp)) {
      return cached;
    }
  }

  const stored = readStoredAuthEntries();
  for (const scope of candidateScopes) {
    const cached = stored.find((entry) => entry.wallet === wallet && entry.scope === scope);
    if (cached) {
      authCache.set(getCacheKey(wallet, scope), cached);
      return cached;
    }
  }

  return null;
}

export function clearWalletAuthCache(wallet?: string) {
  const stored = readStoredAuthEntries().filter((entry) => (wallet ? entry.wallet !== wallet.trim() : false));
  authCache.clear();
  if (wallet) {
    for (const entry of stored) {
      authCache.set(getCacheKey(entry.wallet, entry.scope), entry);
    }
  }
  if (typeof window !== "undefined") {
    try {
      if (wallet) {
        writeStoredAuthEntries(stored);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }
}

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
  const cached = getCachedAuth(normalizedWallet, scope);
  const now = Date.now();
  if (cached) {
    return { wallet: normalizedWallet, scope: cached.scope, timestamp: cached.timestamp, signature: cached.signature };
  }

  const message = buildWalletAuthMessage({ wallet: normalizedWallet, scope, timestamp: now });
  const signatureBytes = await signMessage(new TextEncoder().encode(message));
  const signature = bs58.encode(signatureBytes);
  const signed = { wallet: normalizedWallet, scope, timestamp: now, signature };
  persistAuthEntry(signed);
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
