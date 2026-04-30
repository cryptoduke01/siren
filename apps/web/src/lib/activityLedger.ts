"use client";

import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";
import { pushLocalTrade } from "@/lib/localTradeLedger";

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

export type RecentTradeHistoryRow = {
  wallet: string;
  mint: string;
  side: "buy" | "sell";
  token_amount: number | null;
  price_usd: number | null;
  token_name: string | null;
  token_symbol: string | null;
  tx_signature: string | null;
  executed_at: string;
};

type WalletSigner = ((message: Uint8Array) => Promise<Uint8Array>) | undefined;

function toLocalTimestamp(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return Date.now();
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function mirrorActivityLocally(wallet: string, input: Omit<WalletActivityLogInput, "wallet">) {
  if (typeof window === "undefined" || input.activityKind === "volume") return;
  const side =
    input.side === "buy" || input.side === "sell"
      ? input.side
      : input.activityKind === "send" || input.activityKind === "close"
        ? "sell"
        : "buy";

  pushLocalTrade(wallet, {
    ts: toLocalTimestamp(input.timestamp ?? null),
    mint: input.mint?.trim() || input.tokenSymbol?.trim() || input.toSymbol?.trim() || input.fromSymbol?.trim() || "wallet",
    side,
    solAmount: input.solAmount ?? 0,
    tokenAmount: input.tokenAmount ?? 0,
    priceUsd: input.priceUsd ?? 0,
    stakeUsd: input.stakeUsd ?? undefined,
    tokenName: input.tokenName ?? undefined,
    tokenSymbol: input.tokenSymbol ?? undefined,
    txSignature: input.txSignature ?? undefined,
    amountUsd: input.amountUsd ?? undefined,
    fromSymbol: input.fromSymbol ?? undefined,
    toSymbol: input.toSymbol ?? undefined,
    counterparty: input.counterparty ?? undefined,
    note: input.note ?? undefined,
    activityKind: input.activityKind,
  });
}

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
  mirrorActivityLocally(wallet, input);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("siren-activity-logged"));
  }
  return payload?.data ?? null;
}

export async function fetchRecentTradeHistory({
  wallet,
  signMessage,
  limit = 20,
}: {
  wallet: string;
  signMessage: WalletSigner;
  limit?: number;
}): Promise<RecentTradeHistoryRow[]> {
  const authHeaders = await getWalletAuthHeaders({ wallet, signMessage, scope: "read" });
  const res = await fetch(`${API_URL}/api/trades/recent?wallet=${encodeURIComponent(wallet)}&limit=${encodeURIComponent(String(limit))}`, {
    credentials: "omit",
    headers: authHeaders,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to load recent trades.");
  }
  return Array.isArray(payload?.data?.rows) ? (payload.data.rows as RecentTradeHistoryRow[]) : [];
}
