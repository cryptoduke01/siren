import Redis from "ioredis";

let redisClient: Redis | null | undefined;
let warnedUnavailable = false;

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
      console.warn("[redis] connection error:", error.message);
    }
  });

  return redisClient;
}

export async function withRedis<T>(action: (client: Redis) => Promise<T>): Promise<T | null> {
  const client = getRedisClient();
  if (!client) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn("[redis] REDIS_URL is not configured. Falling back to in-memory signal state.");
    }
    return null;
  }

  try {
    if (client.status === "wait") {
      await client.connect();
    }
    return await action(client);
  } catch (error) {
    console.warn(
      "[redis] signal state action failed, using in-memory fallback:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
