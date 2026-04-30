"use client";

import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";

export type WalletActivityKind = "prediction" | "swap" | "token" | "send" | "receive" | "close" | "volume";

export type WalletActivityRow = {
  id: string;
  wallet: string;
  eventKey: string;
  activityKind: WalletActivityKind;
  source: string;
  side: "buy" | "sell" | null;
  mint: string | null;
  solAmount: number | null;
  tokenAmount: number | null;
  priceUsd: number | null;
  stakeUsd: number | null;
  amountUsd: number | null;
  volumeSol: number | null;
  volumeUsd: number | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  fromSymbol: string | null;
  toSymbol: string | null;
  counterparty: string | null;
  note: string | null;
  txSignature: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
};

export type WalletActivityLogInput = {
  wallet: string;
  eventKey?: string | null;
  activityKind: WalletActivityKind;
  source?: string | null;
  side?: "buy" | "sell" | null;
  mint?: string | null;
  solAmount?: number | null;
  tokenAmount?: number | null;
  priceUsd?: number | null;
  stakeUsd?: number | null;
  amountUsd?: number | null;
  volumeSol?: number | null;
  volumeUsd?: number | null;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  fromSymbol?: string | null;
  toSymbol?: string | null;
  counterparty?: string | null;
  note?: string | null;
  txSignature?: string | null;
  timestamp?: number | null;
  metadata?: Record<string, unknown> | null;
};

type WalletSigner = ((message: Uint8Array) => Promise<Uint8Array>) | undefined;

export async function fetchWalletActivity({
  wallet,
  signMessage,
  limit = 40,
}: {
  wallet: string;
  signMessage: WalletSigner;
  limit?: number;
}): Promise<WalletActivityRow[]> {
  const authHeaders = await getWalletAuthHeaders({ wallet, signMessage, scope: "read" });
  const res = await fetch(`${API_URL}/api/activity?wallet=${encodeURIComponent(wallet)}&limit=${encodeURIComponent(String(limit))}`, {
    credentials: "omit",
    headers: authHeaders,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to load wallet activity.");
  }
  return Array.isArray(payload?.data?.rows) ? (payload.data.rows as WalletActivityRow[]) : [];
}

export async function logWalletActivity({
  wallet,
  signMessage,
  input,
}: {
  wallet: string;
  signMessage: WalletSigner;
  input: Omit<WalletActivityLogInput, "wallet">;
}): Promise<WalletActivityRow | null> {
  const authHeaders = await getWalletAuthHeaders({ wallet, signMessage, scope: "write" });
  const res = await fetch(`${API_URL}/api/activity/log`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      wallet,
      ...input,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to log wallet activity.");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("siren-activity-logged"));
  }
  return payload?.data ?? null;
}
