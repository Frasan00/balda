import type {
  CacheEntry,
  CachePluginOptionsResolved,
  CacheProvider,
  CacheServiceInterface,
  CacheStats,
} from "./cache.types.js";
import {
  compress,
  decompress,
  generateLockKey,
  generateTagKey,
  stableStringify,
} from "./cache.utils.js";
import { CACHE_POLL_INTERVAL_MS } from "./cache.constants.js";
import { logger } from "../logger/logger.js";

/**
 * Core cache service implementation wrapping a CacheProvider.
 *
 * Handles all cache operations including:
 * - Get/Set with optional compression
 * - Tag-based invalidation
 * - Pattern-based invalidation
 * - Thundering herd protection (lock acquisition)
 * - Statistics tracking
 */
export class CacheService implements CacheServiceInterface {
  private readonly log = logger.child({ scope: "CacheService" });
  private readonly provider: CacheProvider;
  private readonly options: CachePluginOptionsResolved;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    invalidations: 0,
  };

  constructor(provider: CacheProvider, options: CachePluginOptionsResolved) {
    this.provider = provider;
    this.options = options;
  }

  /**
   * Get a cached value by key.
   * Handles decompression if the entry was stored compressed.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await this.provider.get(key);

      if (!raw) {
        if (this.options.enableStats) {
          this.stats.misses++;
          this.updateHitRate();
        }
        return null;
      }

      if (this.options.enableStats) {
        this.stats.hits++;
        this.updateHitRate();
      }

      const entry: CacheEntry = JSON.parse(raw);
      let data = entry.data;

      if (entry.compressed) {
        data = await decompress(Buffer.from(entry.data, "base64"));
      }

      return JSON.parse(data) as T;
    } catch (error) {
      this.log.error({ error, key }, "Cache get failed");
      return null;
    }
  }

  /**
   * Set a cached value with optional compression and tag registration.
   */
  async set(
    key: string,
    value: unknown,
    ttl: number,
    opts?: { compressed?: boolean; tags?: string[] },
  ): Promise<void> {
    try {
      const serialized = stableStringify(value);
      const shouldCompress =
        opts?.compressed &&
        serialized.length > this.options.compressionThreshold;

      let data = serialized;
      if (shouldCompress) {
        const compressed = await compress(serialized);
        data = compressed.toString("base64");
      }

      const entry: CacheEntry = {
        data,
        compressed: shouldCompress ?? false,
        createdAt: Date.now(),
        ttl,
      };

      await this.provider.set(key, JSON.stringify(entry), ttl);

      // Register key with tags for bulk invalidation
      if (opts?.tags?.length) {
        for (const tag of opts.tags) {
          const tagKey = generateTagKey(this.options.keyPrefix, tag);
          await this.provider.addToSet(tagKey, [key], ttl + 60);
        }
      }
    } catch (error) {
      this.log.error({ error, key }, "Cache set failed");
    }
  }

  /**
   * Invalidate all cache entries with any of the given tags.
   */
  async invalidate(tags: string[]): Promise<number> {
    if (!tags.length) return 0;

    let totalDeleted = 0;

    try {
      for (const tag of tags) {
        const tagKey = generateTagKey(this.options.keyPrefix, tag);
        const keys = await this.provider.getSetMembers(tagKey);

        if (keys.length > 0) {
          const deleted = await this.provider.delMany([...keys, tagKey]);
          totalDeleted += deleted - 1; // Subtract the tag key itself
        }
      }

      if (this.options.enableStats) {
        this.stats.invalidations += totalDeleted;
      }
    } catch (error) {
      this.log.error({ error, tags }, "Cache invalidate failed");
    }

    return totalDeleted;
  }

  /**
   * Invalidate a specific cache key.
   */
  async invalidateKey(key: string): Promise<boolean> {
    try {
      const result = await this.provider.del(key);
      if (result) {
        if (this.options.enableStats) {
          this.stats.invalidations++;
        }
        return true;
      }
    } catch (error) {
      this.log.error({ error, key }, "Cache invalidateKey failed");
    }
    return false;
  }

  /**
   * Invalidate all keys matching a pattern.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let totalDeleted = 0;

    try {
      for await (const keys of this.provider.scan(pattern)) {
        if (keys.length > 0) {
          totalDeleted += await this.provider.delMany(keys);
        }
      }

      if (this.options.enableStats) {
        this.stats.invalidations += totalDeleted;
      }
    } catch (error) {
      this.log.error({ error, pattern }, "Cache invalidatePattern failed");
    }

    return totalDeleted;
  }

  /**
   * Acquire a lock for thundering herd protection.
   * @returns true if lock was acquired, false if already held
   */
  async acquireLock(key: string): Promise<boolean> {
    try {
      const lockKey = generateLockKey(key);
      return await this.provider.acquireLock(lockKey, this.options.lockTimeout);
    } catch (error) {
      this.log.error({ error, key }, "Cache acquireLock failed");
      return true; // Fail open
    }
  }

  /**
   * Release a lock after cache population.
   */
  async releaseLock(key: string): Promise<void> {
    try {
      const lockKey = generateLockKey(key);
      await this.provider.releaseLock(lockKey);
    } catch (error) {
      this.log.warn({ error, key }, "Cache releaseLock failed");
    }
  }

  /**
   * Wait for cache to be populated by another request.
   */
  async waitForCache<T>(key: string, timeoutMs: number): Promise<T | null> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const result = await this.get<T>(key);
      if (result !== null) {
        return result;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, CACHE_POLL_INTERVAL_MS),
      );
    }

    return null;
  }

  /**
   * Get current cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get the underlying cache provider.
   */
  getProvider(): CacheProvider {
    return this.provider;
  }

  /**
   * Disconnect the underlying provider.
   */
  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
