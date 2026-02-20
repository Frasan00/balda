import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CacheService } from "../../src/cache/cache.service.js";
import { MemoryCacheProvider } from "../../src/cache/providers/memory_cache_provider.js";
import { DEFAULT_CACHE_OPTIONS } from "../../src/cache/cache.constants.js";

describe("CacheService", () => {
  let provider: MemoryCacheProvider;
  let service: CacheService;

  beforeEach(() => {
    provider = new MemoryCacheProvider();
    service = new CacheService(provider, { ...DEFAULT_CACHE_OPTIONS });
  });

  afterEach(async () => {
    await service.disconnect();
  });

  describe("get/set", () => {
    it("returns null for non-existent key", async () => {
      const result = await service.get("nonexistent");
      expect(result).toBeNull();
    });

    it("sets and gets value correctly", async () => {
      const testData = { id: "123", name: "test" };
      await service.set("test-key", testData, 60);
      const result = await service.get("test-key");
      expect(result).toEqual(testData);
    });

    it("respects TTL", async () => {
      await service.set("ttl-key", { id: "123" }, 1);
      const immediate = await service.get("ttl-key");
      expect(immediate).toEqual({ id: "123" });

      await new Promise((r) => setTimeout(r, 1100));
      const expired = await service.get("ttl-key");
      expect(expired).toBeNull();
    });

    it("handles compression for large values", async () => {
      const largeData = { data: "x".repeat(2000) };
      await service.set("large-key", largeData, 60, { compressed: true });
      const result = await service.get("large-key");
      expect(result).toEqual(largeData);
    });

    it("skips compression for small values", async () => {
      const smallData = { id: "123" };
      await service.set("small-key", smallData, 60, { compressed: true });
      const result = await service.get("small-key");
      expect(result).toEqual(smallData);
    });
  });

  describe("invalidate", () => {
    it("returns 0 for empty tags array", async () => {
      const count = await service.invalidate([]);
      expect(count).toBe(0);
    });

    it("deletes keys associated with tags", async () => {
      await service.set("tagged-1", { data: 1 }, 60, { tags: ["test-tag"] });
      await service.set("tagged-2", { data: 2 }, 60, { tags: ["test-tag"] });

      expect(await service.get("tagged-1")).not.toBeNull();
      expect(await service.get("tagged-2")).not.toBeNull();

      await service.invalidate(["test-tag"]);

      expect(await service.get("tagged-1")).toBeNull();
      expect(await service.get("tagged-2")).toBeNull();
    });

    it("handles multiple tags", async () => {
      await service.set("multi-1", { data: 1 }, 60, { tags: ["tag-a"] });
      await service.set("multi-2", { data: 2 }, 60, { tags: ["tag-b"] });

      const count = await service.invalidate(["tag-a", "tag-b"]);
      expect(count).toBe(2);

      expect(await service.get("multi-1")).toBeNull();
      expect(await service.get("multi-2")).toBeNull();
    });
  });

  describe("invalidateKey", () => {
    it("returns false for non-existent key", async () => {
      const result = await service.invalidateKey("nonexistent");
      expect(result).toBe(false);
    });

    it("deletes existing key and returns true", async () => {
      await service.set("to-delete", { data: "value" }, 60);
      const result = await service.invalidateKey("to-delete");
      expect(result).toBe(true);
      expect(await service.get("to-delete")).toBeNull();
    });
  });

  describe("invalidatePattern", () => {
    it("deletes keys matching pattern", async () => {
      await service.set("p:user:1", { id: 1 }, 60);
      await service.set("p:user:2", { id: 2 }, 60);
      await service.set("p:other", { id: 3 }, 60);

      const count = await service.invalidatePattern("p:user:*");
      expect(count).toBe(2);

      expect(await service.get("p:user:1")).toBeNull();
      expect(await service.get("p:user:2")).toBeNull();
      expect(await service.get("p:other")).not.toBeNull();
    });
  });

  describe("getStats", () => {
    it("tracks hits correctly", async () => {
      await service.set("stats-hit", { data: "value" }, 60);
      await service.get("stats-hit");
      await service.get("stats-hit");

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
    });

    it("tracks misses correctly", async () => {
      await service.get("nonexistent-1");
      await service.get("nonexistent-2");

      const stats = service.getStats();
      expect(stats.misses).toBe(2);
    });

    it("calculates hit rate correctly", async () => {
      await service.set("rate-test", { data: "value" }, 60);
      await service.get("rate-test"); // hit
      await service.get("nonexistent"); // miss

      const stats = service.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it("tracks invalidations", async () => {
      await service.set("inv-key", { data: "value" }, 60);
      await service.invalidateKey("inv-key");

      const stats = service.getStats();
      expect(stats.invalidations).toBe(1);
    });
  });

  describe("lock operations", () => {
    it("acquires and releases lock", async () => {
      const acquired = await service.acquireLock("test-key");
      expect(acquired).toBe(true);
      await service.releaseLock("test-key");
    });

    it("fails to acquire already held lock", async () => {
      await service.acquireLock("test-key");
      const second = await service.acquireLock("test-key");
      expect(second).toBe(false);
    });
  });

  describe("waitForCache", () => {
    it("returns value when cache is populated", async () => {
      // Set value after a short delay
      setTimeout(async () => {
        await service.set("wait-key", { data: "found" }, 60);
      }, 50);

      const result = await service.waitForCache("wait-key", 500);
      expect(result).toEqual({ data: "found" });
    });

    it("returns null on timeout", async () => {
      const result = await service.waitForCache("never-set", 100);
      expect(result).toBeNull();
    });
  });
});
