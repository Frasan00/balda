import { beforeEach, describe, expect, it } from "vitest";
import { LRUCache } from "../../src/ajv/lru_cache.js";

describe("LRUCache", () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  describe("constructor", () => {
    it("should create a cache with specified max size", () => {
      const cache = new LRUCache<string, string>(5);
      expect(cache.getMaxSize()).toBe(5);
      expect(cache.size).toBe(0);
    });

    it("should use default max size of 1000 if not specified", () => {
      const cache = new LRUCache<string, string>();
      expect(cache.getMaxSize()).toBe(1000);
    });

    it("should throw error if maxSize is zero", () => {
      expect(() => new LRUCache<string, string>(0)).toThrow(
        "LRU cache maxSize must be greater than 0, got: 0",
      );
    });

    it("should throw error if maxSize is negative", () => {
      expect(() => new LRUCache<string, string>(-5)).toThrow(
        "LRU cache maxSize must be greater than 0, got: -5",
      );
    });
  });

  describe("basic operations", () => {
    it("should set and get values", () => {
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
      expect(cache.size).toBe(1);
    });

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should check if key exists", () => {
      cache.set("a", 1);
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      expect(cache.size).toBe(3);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
    });

    it("should update existing key value", () => {
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);

      cache.set("a", 100);
      expect(cache.get("a")).toBe(100);
      expect(cache.size).toBe(1); // Size should remain the same
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used item when cache is full", () => {
      // Fill cache to capacity (max size = 3)
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      expect(cache.size).toBe(3);

      // Add a fourth item - should evict "a" (oldest)
      cache.set("d", 4);
      expect(cache.size).toBe(3);
      expect(cache.get("a")).toBeUndefined(); // "a" was evicted
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("should update LRU order when accessing items", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access "a" to make it most recently used
      cache.get("a");

      // Add a new item - should evict "b" (now the oldest)
      cache.set("d", 4);
      expect(cache.get("a")).toBe(1); // "a" is still there
      expect(cache.get("b")).toBeUndefined(); // "b" was evicted
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("should handle multiple evictions correctly", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Add three more items - should evict a, b, c in order
      cache.set("d", 4);
      cache.set("e", 5);
      cache.set("f", 6);

      expect(cache.size).toBe(3);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
      expect(cache.get("d")).toBe(4);
      expect(cache.get("e")).toBe(5);
      expect(cache.get("f")).toBe(6);
    });

    it("should update position when setting existing key", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Update "a" to make it most recently used
      cache.set("a", 100);

      // Add new item - should evict "b" (now oldest)
      cache.set("d", 4);
      expect(cache.get("a")).toBe(100); // "a" is still there with new value
      expect(cache.get("b")).toBeUndefined(); // "b" was evicted
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });
  });

  describe("setMaxSize", () => {
    it("should update max size and evict entries if necessary", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      expect(cache.size).toBe(3);

      // Reduce max size to 2 - should evict oldest entry
      cache.setMaxSize(2);
      expect(cache.getMaxSize()).toBe(2);
      expect(cache.size).toBe(2);
      expect(cache.get("a")).toBeUndefined(); // "a" was evicted
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
    });

    it("should evict multiple entries when significantly reducing size", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Reduce max size to 1 - should evict two oldest entries
      cache.setMaxSize(1);
      expect(cache.size).toBe(1);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBe(3); // Most recent item remains
    });

    it("should allow increasing max size without eviction", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.size).toBe(2);

      cache.setMaxSize(10);
      expect(cache.getMaxSize()).toBe(10);
      expect(cache.size).toBe(2);
      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBe(2);
    });

    it("should throw error if new maxSize is zero", () => {
      expect(() => cache.setMaxSize(0)).toThrow(
        "LRU cache maxSize must be greater than 0, got: 0",
      );
    });

    it("should throw error if new maxSize is negative", () => {
      expect(() => cache.setMaxSize(-1)).toThrow(
        "LRU cache maxSize must be greater than 0, got: -1",
      );
    });
  });

  describe("cache statistics", () => {
    it("should track cache hits", () => {
      cache.set("a", 1);
      cache.set("b", 2);

      // Reset stats to start clean
      cache.resetStats();

      cache.get("a"); // hit
      cache.get("b"); // hit
      cache.get("a"); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1); // 100% hit rate
    });

    it("should track cache misses", () => {
      cache.set("a", 1);

      cache.resetStats();

      cache.get("b"); // miss
      cache.get("c"); // miss
      cache.get("a"); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 5); // 33.33% hit rate
    });

    it("should track evictions", () => {
      cache.resetStats();

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      expect(cache.getStats().evictions).toBe(0);

      cache.set("d", 4); // Should evict "a"
      expect(cache.getStats().evictions).toBe(1);

      cache.set("e", 5); // Should evict "b"
      cache.set("f", 6); // Should evict "c"
      expect(cache.getStats().evictions).toBe(3);
    });

    it("should track evictions during setMaxSize", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      cache.resetStats();

      cache.setMaxSize(1); // Should evict 2 entries
      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });

    it("should return correct cache size and maxSize", () => {
      cache.set("a", 1);
      cache.set("b", 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });

    it("should calculate hit rate correctly with zero accesses", () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it("should reset statistics without clearing cache", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.get("a");
      cache.get("b");
      cache.get("nonexistent");

      let stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.size).toBe(2); // Cache entries still exist
      expect(cache.get("a")).toBe(1); // Data still accessible
    });

    it("should not reset statistics when clearing cache", () => {
      cache.set("a", 1);
      cache.get("a"); // hit
      cache.get("b"); // miss

      cache.clear();

      const stats = cache.getStats();
      // Stats should still reflect previous operations
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(0); // But cache is empty
    });
  });

  describe("edge cases", () => {
    it("should handle cache with size 1", () => {
      const tinyCache = new LRUCache<string, number>(1);

      tinyCache.set("a", 1);
      expect(tinyCache.size).toBe(1);
      expect(tinyCache.get("a")).toBe(1);

      tinyCache.set("b", 2);
      expect(tinyCache.size).toBe(1);
      expect(tinyCache.get("a")).toBeUndefined();
      expect(tinyCache.get("b")).toBe(2);
    });

    it("should handle large number of evictions", () => {
      const smallCache = new LRUCache<number, string>(5);

      // Add 100 items - should evict 95
      for (let i = 0; i < 100; i++) {
        smallCache.set(i, `value-${i}`);
      }

      expect(smallCache.size).toBe(5);

      // Should only have the last 5 items
      for (let i = 0; i < 95; i++) {
        expect(smallCache.get(i)).toBeUndefined();
      }

      for (let i = 95; i < 100; i++) {
        expect(smallCache.get(i)).toBe(`value-${i}`);
      }
    });

    it("should handle different key and value types", () => {
      const objCache = new LRUCache<object, object>(2);
      const key1 = { id: 1 };
      const key2 = { id: 2 };
      const value1 = { data: "a" };
      const value2 = { data: "b" };

      objCache.set(key1, value1);
      objCache.set(key2, value2);

      expect(objCache.get(key1)).toBe(value1);
      expect(objCache.get(key2)).toBe(value2);
    });

    it("should return iterator for entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      const entries = Array.from(cache.entries());
      expect(entries).toHaveLength(3);
      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });

    it("should maintain correct order in entries after get", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access "a" to make it most recently used
      cache.get("a");

      // Order should now be: b, c, a
      const entries = Array.from(cache.entries());
      expect(entries).toEqual([
        ["b", 2],
        ["c", 3],
        ["a", 1],
      ]);
    });
  });
});
