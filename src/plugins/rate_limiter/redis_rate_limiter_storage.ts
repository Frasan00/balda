import { runtime } from "../../runtime/runtime.js";
import type {
  CustomStorageStrategy,
  IncrementResult,
} from "./rate_limiter_types.js";

export type RedisRateLimitStorageOptions = {
  /** Redis connection URL. Takes precedence over the individual connection fields. */
  url?: string;
  /** @default "localhost" */
  host?: string;
  /** @default 6379 */
  port?: number;
  password?: string;
  /** @default 0 */
  db?: number;
  /** Prefix applied to every rate-limit key. */
  keyPrefix?: string;
};

type RedisLikeClient = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

/**
 * Redis-backed fixed-window storage for the rate limiter.
 * Uses the built-in `Bun.RedisClient` on Bun and dynamically imports `ioredis` on
 * Node and Deno.
 *
 * @example
 * ```ts
 * server.use(rateLimiter({ type: "ip", limit: 100 }, redisRateLimitStorage({ url: process.env.REDIS_URL })));
 * ```
 */
export function redisRateLimitStorage(
  options: RedisRateLimitStorageOptions = {},
): CustomStorageStrategy {
  const keyPrefix = options.keyPrefix ?? "";
  let clientPromise: Promise<RedisLikeClient> | undefined;

  const getClient = (): Promise<RedisLikeClient> => {
    clientPromise ??= createClient(options);
    return clientPromise;
  };

  return {
    type: "custom",
    async increment(key, windowMs): Promise<IncrementResult> {
      const client = await getClient();
      const fullKey = keyPrefix + key;

      const count = Number(await client.incr(fullKey));
      // Only the request that creates the key owns its TTL, so a fresh window
      // can never inherit a previous one's expiry.
      if (count === 1) {
        await client.pexpire(fullKey, windowMs);
      }

      const ttl = Number(await client.pttl(fullKey));
      return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
    },
  };
}

/** Bun's RedisClient only accepts a connection URL, so build one from the fields. */
function buildRedisUrl(options: RedisRateLimitStorageOptions): string {
  const auth = options.password
    ? `:${encodeURIComponent(options.password)}@`
    : "";
  const host = options.host ?? "localhost";
  const port = options.port ?? 6379;
  const db = options.db ?? 0;
  return `redis://${auth}${host}:${port}/${db}`;
}

async function createClient(
  options: RedisRateLimitStorageOptions,
): Promise<RedisLikeClient> {
  if (runtime.type === "bun") {
    // Reached via globalThis so TypeScript does not require Bun's ambient types.
    const BunRedisClient = (globalThis as any).Bun?.RedisClient;
    if (!BunRedisClient) {
      throw new Error("Bun.RedisClient is not available in this Bun version.");
    }
    return new BunRedisClient(
      options.url ?? buildRedisUrl(options),
    ) as RedisLikeClient;
  }

  let Redis: typeof import("ioredis").default;
  try {
    const { default: RedisClient } = await import("ioredis");
    Redis = RedisClient as unknown as typeof import("ioredis").default;
  } catch {
    throw new Error(
      "ioredis is required for redisRateLimitStorage. Install it with: npm install ioredis",
    );
  }

  return (options.url
    ? new Redis(options.url)
    : new Redis({
        host: options.host ?? "localhost",
        port: options.port ?? 6379,
        password: options.password,
        db: options.db ?? 0,
      })) as unknown as RedisLikeClient;
}
