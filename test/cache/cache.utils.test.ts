import { describe, it, expect } from "vitest";
import {
  generateCacheKey,
  selectKeys,
  hashData,
  stableStringify,
  normalizeRoute,
  compress,
  decompress,
  generateLockKey,
  generateTagKey,
  resolveCacheConfig,
} from "../../src/cache/cache.utils.js";

describe("generateCacheKey", () => {
  const defaultParams = {
    prefix: "cache",
    method: "GET",
    route: "/api/test",
    includeBody: false,
    includeQuery: false,
    includeHeaders: false,
  };

  it("generates correct key for global scope", () => {
    const key = generateCacheKey({
      ...defaultParams,
    });

    expect(key).toBe("cache:global:GET:/api/test");
  });

  it("includes route params in key automatically", () => {
    const key = generateCacheKey({
      ...defaultParams,
      routeParams: { id: "123" },
    });

    expect(key).toMatch(/^cache:global:GET:\/api\/test:[a-f0-9]{32}$/);
  });

  it("includes body in key when includeBody is true", () => {
    const key = generateCacheKey({
      ...defaultParams,
      body: { id: "123" },
      includeBody: true,
    });

    expect(key).toMatch(/^cache:global:GET:\/api\/test:b:[a-f0-9]{32}$/);
  });

  it("includes selected body keys in key", () => {
    const key1 = generateCacheKey({
      ...defaultParams,
      body: { id: "123", extra: "ignored" },
      bodyKeys: ["id"],
      includeBody: true,
    });

    const key2 = generateCacheKey({
      ...defaultParams,
      body: { id: "123", extra: "different" },
      bodyKeys: ["id"],
      includeBody: true,
    });

    expect(key1).toBe(key2);
  });

  it("includes query in key when includeQuery is true", () => {
    const key = generateCacheKey({
      ...defaultParams,
      query: { page: "1", limit: "10" },
      includeQuery: true,
    });

    expect(key).toMatch(/^cache:global:GET:\/api\/test:q:[a-f0-9]{32}$/);
  });

  it("includes selected query keys in key", () => {
    const key1 = generateCacheKey({
      ...defaultParams,
      query: { page: "1", limit: "10", extra: "foo" },
      queryKeys: ["page"],
      includeQuery: true,
    });

    const key2 = generateCacheKey({
      ...defaultParams,
      query: { page: "1", limit: "99", extra: "bar" },
      queryKeys: ["page"],
      includeQuery: true,
    });

    expect(key1).toBe(key2);
  });

  it("includes headers in key when includeHeaders is true", () => {
    const key = generateCacheKey({
      ...defaultParams,
      headers: { "accept-language": "en" },
      includeHeaders: true,
    });

    expect(key).toMatch(/^cache:global:GET:\/api\/test:h:[a-f0-9]{32}$/);
  });

  it("includes selected header keys", () => {
    const key1 = generateCacheKey({
      ...defaultParams,
      headers: { "accept-language": "en", "x-custom": "a" },
      headerKeys: ["accept-language"],
      includeHeaders: true,
    });

    const key2 = generateCacheKey({
      ...defaultParams,
      headers: { "accept-language": "en", "x-custom": "b" },
      headerKeys: ["accept-language"],
      includeHeaders: true,
    });

    expect(key1).toBe(key2);
  });

  it("generates full composite key with all segments", () => {
    const key = generateCacheKey({
      prefix: "cache",
      method: "POST",
      route: "/api/items",
      routeParams: { id: "42" },
      body: { name: "test" },
      includeBody: true,
      query: { page: "1" },
      includeQuery: true,
      headers: { "x-lang": "en" },
      includeHeaders: true,
    });

    // Should have: prefix:global:METHOD:route:paramsHash:q:queryHash:b:bodyHash:h:headersHash
    const parts = key.split(":");
    expect(parts[0]).toBe("cache");
    expect(parts[1]).toBe("global");
    expect(parts[2]).toBe("POST");
    expect(parts[3]).toBe("/api/items");
    // 4 = paramsHash
    expect(parts[5]).toBe("q");
    // 6 = queryHash
    expect(parts[7]).toBe("b");
    // 8 = bodyHash
    expect(parts[9]).toBe("h");
  });
});

describe("selectKeys", () => {
  const data = { id: "123", name: "test", extra: "value" };

  it("returns entire object when keys is undefined", () => {
    const result = selectKeys(data, undefined);
    expect(result).toEqual(data);
  });

  it("returns entire object when keys is empty array", () => {
    const result = selectKeys(data, []);
    expect(result).toEqual(data);
  });

  it("returns only specified keys", () => {
    const result = selectKeys(data, ["id", "name"]);
    expect(result).toEqual({ id: "123", name: "test" });
  });

  it("ignores keys not present in data", () => {
    const result = selectKeys(data, ["id", "nonexistent"]);
    expect(result).toEqual({ id: "123" });
  });
});

describe("hashData", () => {
  it("returns 32 character hex string", () => {
    const hash = hashData({ id: "123" });
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("produces deterministic output for same input", () => {
    const hash1 = hashData({ id: "123", name: "test" });
    const hash2 = hashData({ id: "123", name: "test" });
    expect(hash1).toBe(hash2);
  });

  it("produces different output for different input", () => {
    const hash1 = hashData({ id: "123" });
    const hash2 = hashData({ id: "456" });
    expect(hash1).not.toBe(hash2);
  });
});

describe("stableStringify", () => {
  it("produces same output regardless of key order", () => {
    const str1 = stableStringify({ b: 2, a: 1 });
    const str2 = stableStringify({ a: 1, b: 2 });
    expect(str1).toBe(str2);
  });

  it("handles nested objects", () => {
    const str1 = stableStringify({ outer: { b: 2, a: 1 } });
    const str2 = stableStringify({ outer: { a: 1, b: 2 } });
    expect(str1).toBe(str2);
  });

  it("handles arrays (preserves order)", () => {
    const str1 = stableStringify({ arr: [1, 2, 3] });
    const str2 = stableStringify({ arr: [3, 2, 1] });
    expect(str1).not.toBe(str2);
  });

  it("handles null and undefined", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(undefined)).toBe("");
  });

  it("handles primitives", () => {
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify(true)).toBe("true");
  });
});

describe("normalizeRoute", () => {
  it("converts to lowercase", () => {
    expect(normalizeRoute("/API/Test")).toBe("/api/test");
  });

  it("collapses multiple slashes", () => {
    expect(normalizeRoute("/api//test///endpoint")).toBe("/api/test/endpoint");
  });

  it("removes trailing slash", () => {
    expect(normalizeRoute("/api/test/")).toBe("/api/test");
  });
});

describe("compress/decompress", () => {
  it("compresses and decompresses correctly", async () => {
    const original = "Hello, World! This is a test string.";
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(original);
  });

  it("handles UTF-8 characters", async () => {
    const original = "Hello, 世界! Привет мир! 🚀";
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(original);
  });

  it("handles empty string", async () => {
    const original = "";
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(original);
  });
});

describe("generateLockKey", () => {
  it("prepends lock: prefix", () => {
    const lockKey = generateLockKey("cache:user:123:/api/test:abc");
    expect(lockKey).toBe("lock:cache:user:123:/api/test:abc");
  });
});

describe("generateTagKey", () => {
  it("generates correct tag key format", () => {
    const tagKey = generateTagKey("cache", "chat-messages");
    expect(tagKey).toBe("cache:tag:chat-messages");
  });
});

describe("resolveCacheConfig", () => {
  it("defaults to includeBody true when no include specified", () => {
    const resolved = resolveCacheConfig({
      ttl: 60,
    });

    expect(resolved.includeBody).toBe(true);
    expect(resolved.includeQuery).toBe(false);
    expect(resolved.includeHeaders).toBe(false);
  });

  it("resolves body as string array for picks", () => {
    const resolved = resolveCacheConfig({
      ttl: 60,
      include: { body: ["id", "name"] },
    });

    expect(resolved.includeBody).toBe(true);
    expect(resolved.bodyKeys).toEqual(["id", "name"]);
  });

  it("resolves query as true (all fields)", () => {
    const resolved = resolveCacheConfig({
      ttl: 60,
      include: { query: true },
    });

    expect(resolved.includeQuery).toBe(true);
    expect(resolved.queryKeys).toBeUndefined();
  });

  it("resolves headers with specific picks", () => {
    const resolved = resolveCacheConfig({
      ttl: 60,
      include: { headers: ["accept-language"] },
    });

    expect(resolved.includeHeaders).toBe(true);
    expect(resolved.headerKeys).toEqual(["accept-language"]);
  });

  it("disables body when include is provided but body is undefined", () => {
    const resolved = resolveCacheConfig({
      ttl: 60,
      include: { query: true },
    });

    expect(resolved.includeBody).toBe(false);
    expect(resolved.includeQuery).toBe(true);
  });

  it("preserves other config fields", () => {
    const resolved = resolveCacheConfig({
      ttl: 120,
      useCompression: true,
      tags: ["users"],
      lockBehavior: "fail",
    });

    expect(resolved.ttl).toBe(120);
    expect(resolved.useCompression).toBe(true);
    expect(resolved.tags).toEqual(["users"]);
    expect(resolved.lockBehavior).toBe("fail");
  });
});
