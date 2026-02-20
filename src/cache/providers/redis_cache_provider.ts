import type { CacheProvider, CacheRedisOptions } from "../cache.types.js";
import type { Redis as RedisClient } from "ioredis";

/**
 * Redis-backed cache provider using ioredis (dynamically imported).
 * Requires `ioredis` as a peer dependency.
 */
export class RedisCacheProvider implements CacheProvider {
  private redis: RedisClient | null = null;
  private options: CacheRedisOptions;

  constructor(options: CacheRedisOptions = {}) {
    this.options = options;
  }

  /** Lazily connect to Redis on first use */
  private async getClient(): Promise<RedisClient> {
    if (this.redis) {
      return this.redis;
    }

    let Redis: typeof import("ioredis").default;
    try {
      const { default: RedisClient } = await import("ioredis");
      Redis = RedisClient as unknown as typeof import("ioredis").default;
    } catch {
      throw new Error(
        "ioredis is required for RedisCacheProvider. Install it with: npm install ioredis",
      );
    }

    if (this.options.url) {
      this.redis = new Redis(this.options.url);
    } else {
      this.redis = new Redis({
        host: this.options.host ?? "localhost",
        port: this.options.port ?? 6379,
        password: this.options.password,
        db: this.options.db ?? 0,
        keyPrefix: this.options.keyPrefix,
      });
    }

    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    await client.set(key, value, "EX", ttlSeconds);
  }

  async del(key: string): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.del(key);
    return result > 0;
  }

  async delMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const client = await this.getClient();
    return client.del(...keys);
  }

  async addToSet(
    key: string,
    members: string[],
    ttlSeconds?: number,
  ): Promise<void> {
    if (members.length === 0) return;
    const client = await this.getClient();
    const pipeline = client.pipeline();
    pipeline.sadd(key, ...members);
    if (ttlSeconds) {
      pipeline.expire(key, ttlSeconds);
    }
    await pipeline.exec();
  }

  async getSetMembers(key: string): Promise<string[]> {
    const client = await this.getClient();
    return client.smembers(key);
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.set(key, "1", "PX", ttlMs, "NX");
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async *scan(pattern: string): AsyncIterable<string[]> {
    const client = await this.getClient();
    const prefix = this.options.keyPrefix || "";
    const matchPattern = prefix + pattern;
    let cursor = "0";
    do {
      const [nextCursor, keys]: [string, string[]] = await client.scan(
        cursor,
        "MATCH",
        matchPattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        yield prefix
          ? keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k))
          : keys;
      }
    } while (cursor !== "0");
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
