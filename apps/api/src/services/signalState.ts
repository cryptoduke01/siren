import type {
  PredictionSignal,
  SignalFeedSnapshot,
  SignalSource,
  SignalSourceStatus,
} from "@siren/shared";
import { withRedis } from "../lib/redis.js";

export interface MarketProbabilitySnapshot {
  probability: number;
  question: string;
  volume: number;
  capturedAt: number;
}

const SIGNAL_FEED_KEY = "siren:signals:feed";
const SIGNAL_STATUS_KEY = "siren:signals:status";
const SNAPSHOT_KEY_PREFIX = "siren:signals:snapshots";
const SNAPSHOT_TTL_MS = 2 * 60 * 1000;
const MAX_SIGNAL_ITEMS = 100;

const memorySnapshots = new Map<string, MarketProbabilitySnapshot[]>();
let memorySignals: PredictionSignal[] = [];
let memoryUpdatedAt = new Date().toISOString();
const memoryStatuses = new Map<SignalSource, SignalSourceStatus>([
  ["kalshi", { source: "kalshi", connected: false }],
  ["polymarket", { source: "polymarket", connected: false }],
]);

function snapshotKey(source: SignalSource, marketId: string) {
  return `${SNAPSHOT_KEY_PREFIX}:${source}:${marketId}`;
}

function compactSignals(signals: PredictionSignal[]): PredictionSignal[] {
  const byMarketKey = new Map<string, PredictionSignal>();

  for (const signal of signals) {
    const dedupeKey = `${signal.source}:${signal.marketId}`;
    const current = byMarketKey.get(dedupeKey);
    if (!current || Date.parse(signal.timestamp) > Date.parse(current.timestamp)) {
      byMarketKey.set(dedupeKey, signal);
    }
  }

  return [...byMarketKey.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_SIGNAL_ITEMS);
}

function defaultStatuses(): SignalSourceStatus[] {
  return [
    memoryStatuses.get("kalshi") ?? { source: "kalshi", connected: false },
    memoryStatuses.get("polymarket") ?? { source: "polymarket", connected: false },
  ];
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await withRedis((client) => client.get(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown, ttlMs?: number): Promise<void> {
  const payload = JSON.stringify(value);
  await withRedis(async (client) => {
    if (ttlMs) {
      await client.set(key, payload, "PX", ttlMs);
    } else {
      await client.set(key, payload);
    }
    return true;
  });
}

async function getStoredStatuses(): Promise<SignalSourceStatus[]> {
  const redisStatuses = await readJson<SignalSourceStatus[]>(SIGNAL_STATUS_KEY);
  if (redisStatuses?.length) {
    for (const status of redisStatuses) {
      memoryStatuses.set(status.source, status);
    }
    return defaultStatuses();
  }
  return defaultStatuses();
}

async function setStoredStatuses(statuses: SignalSourceStatus[]): Promise<void> {
  for (const status of statuses) {
    memoryStatuses.set(status.source, status);
  }
  memoryUpdatedAt = new Date().toISOString();
  await writeJson(SIGNAL_STATUS_KEY, defaultStatuses());
}

async function getStoredSignals(): Promise<PredictionSignal[]> {
  const redisSignals = await readJson<PredictionSignal[]>(SIGNAL_FEED_KEY);
  if (redisSignals?.length) {
    const compacted = compactSignals(redisSignals);
    memorySignals = compacted;
    if (compacted.length !== redisSignals.length) {
      await writeJson(SIGNAL_FEED_KEY, compacted);
    }
    return compacted;
  }
  return memorySignals;
}

async function setStoredSignals(signals: PredictionSignal[]): Promise<void> {
  memorySignals = signals;
  memoryUpdatedAt = new Date().toISOString();
  await writeJson(SIGNAL_FEED_KEY, signals);
}

async function getStoredSnapshots(source: SignalSource, marketId: string): Promise<MarketProbabilitySnapshot[]> {
  const key = snapshotKey(source, marketId);
  const redisSnapshots = await readJson<MarketProbabilitySnapshot[]>(key);
  const now = Date.now();
  const filtered = (redisSnapshots ?? memorySnapshots.get(key) ?? []).filter(
    (snapshot) => now - snapshot.capturedAt <= SNAPSHOT_TTL_MS
  );
  memorySnapshots.set(key, filtered);
  return filtered;
}

async function setStoredSnapshots(
  source: SignalSource,
  marketId: string,
  snapshots: MarketProbabilitySnapshot[]
): Promise<void> {
  const key = snapshotKey(source, marketId);
  memorySnapshots.set(key, snapshots);
  await writeJson(key, snapshots, SNAPSHOT_TTL_MS);
}

export async function getSignalFeedSnapshot(): Promise<SignalFeedSnapshot> {
  const [signals, status] = await Promise.all([getStoredSignals(), getStoredStatuses()]);
  return {
    signals,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function getInMemorySignalFeedSnapshot(): SignalFeedSnapshot {
  return {
    signals: memorySignals,
    status: defaultStatuses(),
    updatedAt: memoryUpdatedAt,
  };
}

export async function getProbabilitySnapshot60sAgo(
  source: SignalSource,
  marketId: string,
  now = Date.now()
): Promise<MarketProbabilitySnapshot | null> {
  const snapshots = await getStoredSnapshots(source, marketId);
  const target = now - 60_000;
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index].capturedAt <= target) {
      return snapshots[index];
    }
  }
  return null;
}

export async function saveProbabilitySnapshot(
  source: SignalSource,
  marketId: string,
  snapshot: MarketProbabilitySnapshot
): Promise<void> {
  const existing = await getStoredSnapshots(source, marketId);
  const snapshots = [...existing, snapshot]
    .filter((entry) => snapshot.capturedAt - entry.capturedAt <= SNAPSHOT_TTL_MS)
    .sort((a, b) => a.capturedAt - b.capturedAt)
    .slice(-8);

  await setStoredSnapshots(source, marketId, snapshots);
}

export async function markSignalSourceHealthy(source: SignalSource): Promise<SignalFeedSnapshot> {
  const statuses = await getStoredStatuses();
  const nowIso = new Date().toISOString();
  const next = statuses.map((status) =>
    status.source === source
      ? {
          ...status,
          connected: true,
          lastSuccessAt: nowIso,
          lastError: undefined,
        }
      : status
  );
  await setStoredStatuses(next);
  return getSignalFeedSnapshot();
}

export async function markSignalSourceFailed(source: SignalSource, error: unknown): Promise<SignalFeedSnapshot> {
  const statuses = await getStoredStatuses();
  const nowIso = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const next = statuses.map((status) =>
    status.source === source
      ? {
          ...status,
          connected: false,
          lastFailureAt: nowIso,
          lastError: message,
        }
      : status
  );
  await setStoredStatuses(next);
  return getSignalFeedSnapshot();
}

export async function publishSignals(nextSignals: PredictionSignal[]): Promise<SignalFeedSnapshot> {
  if (nextSignals.length === 0) return getSignalFeedSnapshot();

  const existingSignals = await getStoredSignals();
  const merged = compactSignals([...nextSignals, ...existingSignals]);

  await setStoredSignals(merged);
  return getSignalFeedSnapshot();
}
