import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryCacheProvider } from "../../src/cache/providers/memory_cache_provider.js";

describe("MemoryCacheProvider", () => {
  let provider: MemoryCacheProvider;

  beforeEach(() => {
    provider = new MemoryCacheProvider();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe("get/set", () => {
    it("returns null for non-existent key", async () => {
      const result = await provider.get("nonexistent");
      expect(result).toBeNull();
    });

    it("sets and gets value correctly", async () => {
      await provider.set("key1", '{"id":"123"}', 60);
      const result = await provider.get("key1");
      expect(result).toBe('{"id":"123"}');
    });

    it("respects TTL (value expires)", async () => {
      await provider.set("ttl-key", "value", 1);
      const immediate = await provider.get("ttl-key");
      expect(immediate).toBe("value");

      await new Promise((r) => setTimeout(r, 1100));
      const expired = await provider.get("ttl-key");
      expect(expired).toBeNull();
    });
  });

  describe("del", () => {
    it("returns false for non-existent key", async () => {
      const result = await provider.del("nonexistent");
      expect(result).toBe(false);
    });

    it("deletes existing key and returns true", async () => {
      await provider.set("to-delete", "value", 60);
      const result = await provider.del("to-delete");
      expect(result).toBe(true);
      expect(await provider.get("to-delete")).toBeNull();
    });
  });

  describe("delMany", () => {
    it("deletes multiple keys and returns count", async () => {
      await provider.set("key-a", "a", 60);
      await provider.set("key-b", "b", 60);
      await provider.set("key-c", "c", 60);

      const count = await provider.delMany(["key-a", "key-b", "nonexistent"]);
      expect(count).toBe(2);
      expect(await provider.get("key-c")).toBe("c");
    });
  });

  describe("sets", () => {
    it("adds and retrieves set members", async () => {
      await provider.addToSet("myset", ["a", "b", "c"]);
      const members = await provider.getSetMembers("myset");
      expect(members.sort()).toEqual(["a", "b", "c"]);
    });

    it("adds to existing set", async () => {
      await provider.addToSet("myset", ["a"]);
      await provider.addToSet("myset", ["b", "c"]);
      const members = await provider.getSetMembers("myset");
      expect(members.sort()).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for non-existent set", async () => {
      const members = await provider.getSetMembers("nonexistent");
      expect(members).toEqual([]);
    });
  });

  describe("locks", () => {
    it("acquires lock successfully", async () => {
      const acquired = await provider.acquireLock("lock1", 5000);
      expect(acquired).toBe(true);
    });

    it("fails to acquire already held lock", async () => {
      await provider.acquireLock("lock1", 5000);
      const second = await provider.acquireLock("lock1", 5000);
      expect(second).toBe(false);
    });

    it("acquires lock after previous expires", async () => {
      await provider.acquireLock("lock1", 100);
      await new Promise((r) => setTimeout(r, 150));
      const acquired = await provider.acquireLock("lock1", 5000);
      expect(acquired).toBe(true);
    });

    it("releases lock", async () => {
      await provider.acquireLock("lock1", 5000);
      await provider.releaseLock("lock1");
      const acquired = await provider.acquireLock("lock1", 5000);
      expect(acquired).toBe(true);
    });
  });

  describe("scan", () => {
    it("finds keys matching pattern", async () => {
      await provider.set("cache:user:1:data", "a", 60);
      await provider.set("cache:user:2:data", "b", 60);
      await provider.set("cache:other:data", "c", 60);

      const keys: string[] = [];
      for await (const batch of provider.scan("cache:user:*")) {
        keys.push(...batch);
      }
      expect(keys.sort()).toEqual(["cache:user:1:data", "cache:user:2:data"]);
    });

    it("returns no results for non-matching pattern", async () => {
      await provider.set("key1", "a", 60);

      const keys: string[] = [];
      for await (const batch of provider.scan("nomatch:*")) {
        keys.push(...batch);
      }
      expect(keys).toEqual([]);
    });
  });

  describe("disconnect", () => {
    it("clears all data", async () => {
      await provider.set("key1", "a", 60);
      await provider.addToSet("set1", ["a"]);
      await provider.acquireLock("lock1", 5000);

      await provider.disconnect();

      expect(await provider.get("key1")).toBeNull();
      expect(await provider.getSetMembers("set1")).toEqual([]);
    });
  });
});
