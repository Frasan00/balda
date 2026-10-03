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
  /**
   * Replaces the built-in client creation (e.g. bring your own ioredis instance).
   * Called again after a client is discarded, so the connection can be rebuilt.
   */
  createClient?: (
    options: RedisRateLimitStorageOptions,
  ) => Promise<RedisLikeClient>;
  /** Called whenever a cached client is discarded after a failure, before it is rebuilt. */
  onClientReset?: (error: unknown) => void;
};

export type RedisLikeClient = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
  /** Bun's client reports liveness as a boolean. */
  connected?: boolean;
  /** ioredis reports it as a connection state instead. */
  status?: string;
  /** Teardown name differs: Bun exposes `close`, ioredis `disconnect`/`quit`. */
  close?: () => unknown;
  disconnect?: () => unknown;
  quit?: () => unknown;
};

/**
 * Redis-backed fixed-window storage for the rate limiter.
 * Uses the built-in `Bun.RedisClient` on Bun and dynamically imports `ioredis` on
 * Node and Deno.
 *
 * A client that becomes unusable is discarded and rebuilt on the next call, so a
 * Redis outage self-heals instead of breaking the limiter for the process lifetime.
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
  const create = options.createClient ?? createClient;
  let clientPromise: Promise<RedisLikeClient> | undefined;

  // Async wrapper so a factory that throws synchronously still records a rejected promise
  // that the recovery path below can clear.
  const getClient = (): Promise<RedisLikeClient> =>
    (clientPromise ??= (async () => create(options))());

  // Only an unusable client is discarded: a command-level error on a healthy connection
  // (e.g. WRONGTYPE) must not churn connections. Unknown health counts as dead, so custom
  // clients without a liveness flag still recover.
  const isAlive = (client: RedisLikeClient): boolean => {
    if (typeof client.connected === "boolean") {
      return client.connected;
    }
    if (typeof client.status === "string") {
      return client.status === "ready";
    }
    return false;
  };

  const discard = async (
    pending: Promise<RedisLikeClient>,
    client: RedisLikeClient | undefined,
    error: unknown,
  ): Promise<void> => {
    // Compare-and-clear: a concurrent request may already have rebuilt the client, and
    // dropping that newer one would just move the failure forward.
    if (clientPromise !== pending) {
      return;
    }
    if (client && isAlive(client)) {
      return;
    }
    clientPromise = undefined;

    try {
      options.onClientReset?.(error);
    } catch {
      /* an observer must not mask the storage failure */
    }

    const teardown = client?.close ?? client?.disconnect ?? client?.quit;
    if (!teardown) {
      return;
    }
    // Teardown may be sync, async or rejecting; the original error is what must surface.
    try {
      await Promise.resolve(teardown.call(client));
    } catch {
      /* the client was already unusable */
    }
  };

  return {
    type: "custom",
    async increment(key, windowMs): Promise<IncrementResult> {
      const pending = getClient();
      let client: RedisLikeClient;
      try {
        client = await pending;
      } catch (error) {
        await discard(pending, undefined, error);
        throw error;
      }

      const fullKey = keyPrefix + key;
      try {
        const count = Number(await client.incr(fullKey));
        // Only the request that creates the key owns its TTL, so a fresh window
        // can never inherit a previous one's expiry.
        if (count === 1) {
          await client.pexpire(fullKey, windowMs);
        }

        const ttl = Number(await client.pttl(fullKey));
        return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
      } catch (error) {
        await discard(pending, client, error);
        throw error;
      }
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
