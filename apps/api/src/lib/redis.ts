import Redis from "ioredis";

let redisClient: Redis | null | undefined;
let warnedUnavailable = false;
let redisUnavailableUntil = 0;
let lastRedisWarning = "";
const REDIS_COOLDOWN_MS = 60_000;

function warnRedis(message: string): void {
  const now = Date.now();
  if (message === lastRedisWarning && redisUnavailableUntil > now) {
    return;
  }
  lastRedisWarning = message;
  redisUnavailableUntil = now + REDIS_COOLDOWN_MS;
  console.warn(message);
}

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1_500,
  });

  redisClient.on("error", (error) => {
    if (process.env.NODE_ENV !== "test") {
      warnRedis(`[redis] connection error: ${error.message}`);
    }
  });

  return redisClient;
}

export async function withRedis<T>(action: (client: Redis) => Promise<T>): Promise<T | null> {
  if (redisUnavailableUntil > Date.now()) {
    return null;
  }

  const client = getRedisClient();
  if (!client) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      warnRedis("[redis] REDIS_URL is not configured. Falling back to in-memory signal state.");
    }
    return null;
  }

  try {
    if (client.status === "wait") {
      await client.connect();
    }
    return await action(client);
  } catch (error) {
    warnRedis(
      `[redis] signal state action failed, using in-memory fallback: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}
