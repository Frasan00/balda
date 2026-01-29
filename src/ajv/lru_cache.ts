/**
 * Statistics for cache performance monitoring.
 */
export interface LRUCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

/**
 * Simple LRU (Least Recently Used) Cache implementation.
 * Evicts the least recently used items when the cache reaches max size.
 * Tracks hit/miss/eviction metrics for monitoring cache effectiveness.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(maxSize: number = 1000) {
    if (maxSize <= 0) {
      throw new Error(
        `LRU cache maxSize must be greater than 0, got: ${maxSize}`,
      );
    }
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache. Marks it as recently used.
   * Tracks cache hits and misses for monitoring.
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    } else {
      this.misses++;
    }
    return value;
  }

  /**
   * Check if a key exists in the cache.
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Set a value in the cache. Evicts LRU item if cache is full.
   * Tracks evictions for monitoring.
   */
  set(key: K, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // If cache is at max size, remove oldest (first) entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Clear all entries from the cache.
   * Does not reset statistics - use resetStats() for that.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all entries in the cache.
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  /**
   * Get the max size of the cache.
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Set a new max size for the cache. If new size is smaller, evicts oldest entries.
   */
  setMaxSize(newMaxSize: number): void {
    if (newMaxSize <= 0) {
      throw new Error(
        `LRU cache maxSize must be greater than 0, got: ${newMaxSize}`,
      );
    }
    this.maxSize = newMaxSize;

    // Evict oldest entries if cache is now too large
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }
  }

  /**
   * Get cache statistics including hit rate, misses, and evictions.
   * Useful for monitoring cache effectiveness.
   *
   * @returns Cache statistics object with current metrics
   *
   * @example
   * ```ts
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   * console.log(`Evictions: ${stats.evictions}`);
   * ```
   */
  getStats(): LRUCacheStats {
    const totalAccesses = this.hits + this.misses;
    const hitRate = totalAccesses > 0 ? this.hits / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate,
    };
  }

  /**
   * Reset cache statistics counters (hits, misses, evictions).
   * Does not clear the cache entries - use clear() for that.
   *
   * @example
   * ```ts
   * cache.resetStats(); // Reset counters to start fresh monitoring
   * ```
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
}
