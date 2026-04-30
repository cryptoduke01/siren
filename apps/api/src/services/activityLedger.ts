import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoldRushActivityItem } from "./goldrush.js";

export const ACTIVITY_KINDS = ["prediction", "swap", "token", "send", "receive", "close", "volume"] as const;

export type SirenActivityKind = (typeof ACTIVITY_KINDS)[number];

export type SirenActivityLogInput = {
  wallet: string;
  activityKind: SirenActivityKind;
  eventKey?: string | null;
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
  timestamp?: number | string | Date | null;
  metadata?: Record<string, unknown> | null;
};

type SirenActivityLedgerDbRow = {
  id: string;
  wallet: string;
  event_key: string;
  activity_kind: SirenActivityKind;
  source: string;
  side: "buy" | "sell" | null;
  mint: string | null;
  sol_amount: number | null;
  token_amount: number | null;
  price_usd: number | null;
  stake_usd: number | null;
  amount_usd: number | null;
  volume_sol: number | null;
  volume_usd: number | null;
  token_name: string | null;
  token_symbol: string | null;
  from_symbol: string | null;
  to_symbol: string | null;
  counterparty: string | null;
  note: string | null;
  tx_signature: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

export type SirenActivityLedgerRow = {
  id: string;
  wallet: string;
  eventKey: string;
  activityKind: SirenActivityKind;
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

const LEDGER_SELECT =
  "id,wallet,event_key,activity_kind,source,side,mint,sol_amount,token_amount,price_usd,stake_usd,amount_usd,volume_sol,volume_usd,token_name,token_symbol,from_symbol,to_symbol,counterparty,note,tx_signature,metadata,occurred_at,created_at";
const PAGE = 1000;
const MAX_VOLUME_ROWS = 100_000;

function isMissingActivityTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = (err.code || "").toLowerCase();
  return code === "42p01" || msg.includes("siren_activity_ledger") || msg.includes("schema cache") || msg.includes("does not exist");
}

function getWalletCandidates(rawWallet: string | null | undefined): string[] {
  const exact = typeof rawWallet === "string" ? rawWallet.trim() : "";
  if (!exact) return [];
  const legacyLower = exact.toLowerCase();
  return legacyLower === exact ? [exact] : [exact, legacyLower];
}

function buildWalletOrFilter(wallets: string[]): string {
  return wallets.map((wallet) => `wallet.eq.${wallet}`).join(",");
}

function cleanText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanPositiveNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function cleanNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTimestamp(value?: number | string | Date | null): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 1_000_000_000_000 ? value * 1000 : value).toISOString();
  }
  return new Date().toISOString();
}

function cleanActivityKind(value: string): SirenActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value) ? (value as SirenActivityKind) : "token";
}

function buildEventKey(input: SirenActivityLogInput, occurredAtIso: string): string {
  const explicit = cleanText(input.eventKey);
  if (explicit) return explicit;

  const wallet = input.wallet.trim();
  const txSignature = cleanText(input.txSignature);
  const mint = cleanText(input.mint);
  const side = cleanText(input.side);
  if (txSignature && mint) return `tx:${wallet}:${txSignature}:${input.activityKind}:${mint}`;
  if (txSignature) return `tx:${wallet}:${txSignature}:${input.activityKind}`;
  return [
    "manual",
    wallet,
    input.activityKind,
    mint ?? "nomint",
    side ?? "noside",
    occurredAtIso,
    String(cleanPositiveNumber(input.tokenAmount) ?? cleanPositiveNumber(input.amountUsd) ?? 0),
  ].join(":");
}

function mapDbRow(row: SirenActivityLedgerDbRow): SirenActivityLedgerRow {
  return {
    id: row.id,
    wallet: row.wallet,
    eventKey: row.event_key,
    activityKind: row.activity_kind,
    source: row.source,
    side: row.side,
    mint: row.mint,
    solAmount: row.sol_amount,
    tokenAmount: row.token_amount,
    priceUsd: row.price_usd,
    stakeUsd: row.stake_usd,
    amountUsd: row.amount_usd,
    volumeSol: row.volume_sol,
    volumeUsd: row.volume_usd,
    tokenName: row.token_name,
    tokenSymbol: row.token_symbol,
    fromSymbol: row.from_symbol,
    toSymbol: row.to_symbol,
    counterparty: row.counterparty,
    note: row.note,
    txSignature: row.tx_signature,
    metadata: row.metadata ?? null,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export async function insertWalletActivity(
  client: SupabaseClient,
  input: SirenActivityLogInput,
): Promise<{ row: SirenActivityLedgerRow | null; persisted: boolean; missingTable?: boolean; warning?: string }> {
  const wallet = input.wallet.trim();
  if (!wallet) {
    return { row: null, persisted: false, warning: "wallet required" };
  }

  const occurredAt = normalizeTimestamp(input.timestamp);
  const eventKey = buildEventKey(input, occurredAt);
  const payload = {
    wallet,
    event_key: eventKey,
    activity_kind: cleanActivityKind(input.activityKind),
    source: cleanText(input.source) ?? "app",
    side: input.side === "buy" || input.side === "sell" ? input.side : null,
    mint: cleanText(input.mint),
    sol_amount: cleanPositiveNumber(input.solAmount),
    token_amount: cleanPositiveNumber(input.tokenAmount),
    price_usd: cleanPositiveNumber(input.priceUsd),
    stake_usd: cleanPositiveNumber(input.stakeUsd),
    amount_usd: cleanPositiveNumber(input.amountUsd),
    volume_sol: cleanPositiveNumber(input.volumeSol),
    volume_usd: cleanPositiveNumber(input.volumeUsd ?? input.amountUsd ?? input.stakeUsd),
    token_name: cleanText(input.tokenName),
    token_symbol: cleanText(input.tokenSymbol),
    from_symbol: cleanText(input.fromSymbol),
    to_symbol: cleanText(input.toSymbol),
    counterparty: cleanText(input.counterparty),
    note: cleanText(input.note),
    tx_signature: cleanText(input.txSignature),
    metadata: input.metadata ?? {},
    occurred_at: occurredAt,
  };

  const { data, error } = await client
    .from("siren_activity_ledger")
    .upsert(payload, { onConflict: "event_key" })
    .select(LEDGER_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingActivityTable(error)) {
      return { row: null, persisted: false, missingTable: true, warning: error.message || "siren_activity_ledger missing" };
    }
    throw new Error(error.message || "Unable to log wallet activity");
  }

  return { row: data ? mapDbRow(data as SirenActivityLedgerDbRow) : null, persisted: true };
}

export async function getWalletActivity(
  client: SupabaseClient,
  wallet: string,
  limit = 40,
): Promise<SirenActivityLedgerRow[]> {
  const candidates = getWalletCandidates(wallet);
  if (candidates.length === 0) return [];

  let query = client
    .from("siren_activity_ledger")
    .select(LEDGER_SELECT)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  query = candidates.length === 1 ? query.eq("wallet", candidates[0]) : query.or(buildWalletOrFilter(candidates));

  const { data, error } = await query;
  if (error) {
    if (isMissingActivityTable(error)) return [];
    throw new Error(error.message || "Unable to load wallet activity");
  }

  return ((data ?? []) as SirenActivityLedgerDbRow[]).map(mapDbRow);
}

export async function syncGoldRushActivityLedger(
  client: SupabaseClient,
  wallet: string,
  activity: GoldRushActivityItem[],
): Promise<number> {
  const normalizedWallet = wallet.trim();
  if (!normalizedWallet || activity.length === 0) return 0;

  const txHashes = Array.from(
    new Set(
      activity
        .map((item) => cleanText(item.txHash))
        .filter((item): item is string => !!item),
    ),
  );

  const existingTxs = new Set<string>();
  if (txHashes.length > 0) {
    let existingQuery = client.from("siren_activity_ledger").select("tx_signature");
    const candidates = getWalletCandidates(normalizedWallet);
    existingQuery = candidates.length === 1 ? existingQuery.eq("wallet", candidates[0]) : existingQuery.or(buildWalletOrFilter(candidates));
    const { data, error } = await existingQuery.in("tx_signature", txHashes);
    if (error) {
      if (isMissingActivityTable(error)) return 0;
      throw new Error(error.message || "Unable to sync GoldRush activity");
    }
    for (const row of data ?? []) {
      const txSignature = cleanText((row as { tx_signature?: string | null }).tx_signature);
      if (txSignature) existingTxs.add(txSignature);
    }
  }

  const payloads = activity
    .filter((item) => {
      const txHash = cleanText(item.txHash);
      if (!txHash || existingTxs.has(txHash)) return false;
      return item.direction === "in" || item.direction === "out" || item.direction === "self";
    })
    .map((item) => {
      const direction = item.direction === "in" ? "receive" : "send";
      const txHash = cleanText(item.txHash)!;
      const note =
        item.direction === "in"
          ? "Received funds tracked on-chain via Covalent GoldRush."
          : item.direction === "self"
            ? "Wallet self-transfer tracked on-chain via Covalent GoldRush."
            : "Outgoing funds tracked on-chain via Covalent GoldRush.";
      return {
        wallet: normalizedWallet,
        event_key: `tx:${normalizedWallet}:${txHash}:${direction}`,
        activity_kind: direction,
        source: "goldrush",
        side: item.direction === "in" ? "buy" : "sell",
        mint: null,
        sol_amount: null,
        token_amount: null,
        price_usd: null,
        stake_usd: null,
        amount_usd: cleanPositiveNumber(item.valueUsd),
        volume_sol: null,
        volume_usd: cleanPositiveNumber(item.valueUsd),
        token_name: null,
        token_symbol: null,
        from_symbol: null,
        to_symbol: null,
        counterparty: null,
        note,
        tx_signature: txHash,
        metadata: {
          direction: item.direction,
          successful: item.successful,
          prettyValueUsd: item.prettyValueUsd,
          explorerUrl: item.explorerUrl,
        },
        occurred_at: normalizeTimestamp(item.timestamp),
      };
    });

  if (payloads.length === 0) return 0;

  const { error } = await client.from("siren_activity_ledger").upsert(payloads, { onConflict: "event_key" });
  if (error) {
    if (isMissingActivityTable(error)) return 0;
    throw new Error(error.message || "Unable to store GoldRush activity");
  }

  return payloads.length;
}

type ActivityVolumeRow = {
  wallet: string;
  occurred_at: string;
  volume_sol: number | null;
  volume_usd: number | null;
};

async function fetchAllVolumeRows(client: SupabaseClient): Promise<ActivityVolumeRow[]> {
  const out: ActivityVolumeRow[] = [];
  let from = 0;

  while (out.length < MAX_VOLUME_ROWS) {
    const { data, error } = await client
      .from("siren_activity_ledger")
      .select("wallet,occurred_at,volume_sol,volume_usd")
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      if (isMissingActivityTable(error)) return [];
      throw new Error(error.message || "Unable to load activity volume");
    }

    const rows = (data ?? []) as ActivityVolumeRow[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return out;
}

export async function getActivityVolumeStats(client: SupabaseClient): Promise<{
  platform7d: { volumeSol: number; volumeUsd: number };
  platform30d: { volumeSol: number; volumeUsd: number };
  platformAllTime: { volumeSol: number; volumeUsd: number };
  byWallet: Array<{
    wallet: string;
    volume7d: { volumeSol: number; volumeUsd: number };
    volume30d: { volumeSol: number; volumeUsd: number };
    volumeAllTime: { volumeSol: number; volumeUsd: number };
  }>;
}> {
  const rows = await fetchAllVolumeRows(client);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff7 = now - 7 * dayMs;
  const cutoff30 = now - 30 * dayMs;

  const byWallet = new Map<
    string,
    {
      volume7d: { volumeSol: number; volumeUsd: number };
      volume30d: { volumeSol: number; volumeUsd: number };
      volumeAllTime: { volumeSol: number; volumeUsd: number };
    }
  >();

  const platform7d = { volumeSol: 0, volumeUsd: 0 };
  const platform30d = { volumeSol: 0, volumeUsd: 0 };
  const platformAllTime = { volumeSol: 0, volumeUsd: 0 };

  for (const row of rows) {
    const ts = Date.parse(row.occurred_at);
    if (!Number.isFinite(ts)) continue;
    const volumeSol = cleanPositiveNumber(row.volume_sol) ?? 0;
    const volumeUsd = cleanPositiveNumber(row.volume_usd) ?? 0;
    if (volumeSol <= 0 && volumeUsd <= 0) continue;

    const entry =
      byWallet.get(row.wallet) ??
      {
        volume7d: { volumeSol: 0, volumeUsd: 0 },
        volume30d: { volumeSol: 0, volumeUsd: 0 },
        volumeAllTime: { volumeSol: 0, volumeUsd: 0 },
      };

    entry.volumeAllTime.volumeSol += volumeSol;
    entry.volumeAllTime.volumeUsd += volumeUsd;
    platformAllTime.volumeSol += volumeSol;
    platformAllTime.volumeUsd += volumeUsd;

    if (ts >= cutoff30) {
      entry.volume30d.volumeSol += volumeSol;
      entry.volume30d.volumeUsd += volumeUsd;
      platform30d.volumeSol += volumeSol;
      platform30d.volumeUsd += volumeUsd;
    }
    if (ts >= cutoff7) {
      entry.volume7d.volumeSol += volumeSol;
      entry.volume7d.volumeUsd += volumeUsd;
      platform7d.volumeSol += volumeSol;
      platform7d.volumeUsd += volumeUsd;
    }

    byWallet.set(row.wallet, entry);
  }

  return {
    platform7d,
    platform30d,
    platformAllTime,
    byWallet: [...byWallet.entries()]
      .map(([wallet, value]) => ({ wallet, ...value }))
      .sort((left, right) => right.volume7d.volumeUsd - left.volume7d.volumeUsd || right.volume7d.volumeSol - left.volume7d.volumeSol),
  };
}

export async function getDailyActivityVolumeStats(
  client: SupabaseClient,
  days: number,
): Promise<Array<{ day: string; volumeSol: number; volumeUsd: number }>> {
  const safeDays = Math.min(Math.max(days || 14, 1), 30);
  const rows = await fetchAllVolumeRows(client);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startMs = now - (safeDays - 1) * dayMs;

  const buckets = Array.from({ length: safeDays }, (_, index) => {
    const ts = startMs + index * dayMs;
    return {
      day: new Date(ts).toISOString().slice(0, 10),
      volumeSol: 0,
      volumeUsd: 0,
    };
  });

  for (const row of rows) {
    const ts = Date.parse(row.occurred_at);
    if (!Number.isFinite(ts) || ts < startMs) continue;
    const idx = Math.floor((ts - startMs) / dayMs);
    if (idx < 0 || idx >= buckets.length) continue;
    buckets[idx].volumeSol += cleanPositiveNumber(row.volume_sol) ?? 0;
    buckets[idx].volumeUsd += cleanPositiveNumber(row.volume_usd) ?? 0;
  }

  return buckets;
}
