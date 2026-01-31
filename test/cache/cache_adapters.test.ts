import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InMemoryAdapter } from "../../src/cache/adapters/in_memory.js";
import { RedisCacheAdapter } from "../../src/cache/adapters/redis.js";
import type { CacheAdapter } from "../../src/cache/cache_adapter.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it("should set and get a value", async () => {
    await adapter.set("key1", "value1");
    const value = await adapter.get<string>("key1");
    expect(value).toBe("value1");
  });

  it("should handle objects", async () => {
    const obj = { name: "test", age: 25 };
    await adapter.set("obj", obj);
    const retrieved = await adapter.get<typeof obj>("obj");
    expect(retrieved).toEqual(obj);
  });

  it("should handle arrays", async () => {
    const arr = [1, 2, 3, 4, 5];
    await adapter.set("arr", arr);
    const retrieved = await adapter.get<typeof arr>("arr");
    expect(retrieved).toEqual(arr);
  });

  it("should return undefined for missing keys", async () => {
    const value = await adapter.get("nonexistent");
    expect(value).toBeUndefined();
  });

  it("should invalidate a single key", async () => {
    await adapter.set("key1", "value1");
    await adapter.invalidate("key1");
    const value = await adapter.get("key1");
    expect(value).toBeUndefined();
  });

  it("should invalidate keys by prefix", async () => {
    await adapter.set("users:1", { id: 1 });
    await adapter.set("users:2", { id: 2 });
    await adapter.set("posts:1", { id: 1 });

    await adapter.invalidateAll("users");

    expect(await adapter.get("users:1")).toBeUndefined();
    expect(await adapter.get("users:2")).toBeUndefined();
    expect(await adapter.get("posts:1")).toEqual({ id: 1 });
  });

  it("should respect TTL", async () => {
    await adapter.set("ttl-key", "value", 100); // 100ms TTL

    const value1 = await adapter.get("ttl-key");
    expect(value1).toBe("value");

    await wait(150);

    const value2 = await adapter.get("ttl-key");
    expect(value2).toBeUndefined();
  });

  it("should update existing key with new TTL", async () => {
    await adapter.set("key", "value1", 1000);
    await adapter.set("key", "value2", 100);

    const value1 = await adapter.get("key");
    expect(value1).toBe("value2");

    await wait(150);

    const value2 = await adapter.get("key");
    expect(value2).toBeUndefined();
  });
});

describe("RedisCacheAdapter", () => {
  let adapter: RedisCacheAdapter;
  let redisAvailable = false;

  beforeAll(async () => {
    try {
      adapter = new RedisCacheAdapter({
        host: "localhost",
        port: 6379,
        password: "root",
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });

      // Test connection with timeout
      await Promise.race([
        adapter.set("test-connection", "ok"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 3000),
        ),
      ]);

      await adapter.invalidate("test-connection");
      redisAvailable = true;
    } catch (error) {
      console.warn(
        "Redis not available, skipping Redis tests:",
        (error as Error).message,
      );
      redisAvailable = false;
    }
  }, 5000);

  afterEach(async () => {
    if (!redisAvailable) return;
    // Clean up test keys
    try {
      await adapter.invalidateAll("test");
    } catch {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    if (!redisAvailable) return;
    try {
      await adapter.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

  it("should set and get a value", async () => {
    if (!redisAvailable) return;

    await adapter.set("test:key1", "value1");
    const value = await adapter.get<string>("test:key1");
    expect(value).toBe("value1");
  });

  it("should handle objects", async () => {
    if (!redisAvailable) return;

    const obj = { name: "test", age: 25 };
    await adapter.set("test:obj", obj);
    const retrieved = await adapter.get<typeof obj>("test:obj");
    expect(retrieved).toEqual(obj);
  });

  it("should handle arrays", async () => {
    if (!redisAvailable) return;

    const arr = [1, 2, 3, 4, 5];
    await adapter.set("test:arr", arr);
    const retrieved = await adapter.get<typeof arr>("test:arr");
    expect(retrieved).toEqual(arr);
  });

  it("should handle primitives", async () => {
    if (!redisAvailable) return;

    await adapter.set("test:num", 42);
    const num = await adapter.get<number>("test:num");
    expect(num).toBe(42);

    await adapter.set("test:bool", true);
    const bool = await adapter.get<boolean>("test:bool");
    expect(bool).toBe(true);
  });

  it("should return undefined for missing keys", async () => {
    if (!redisAvailable) return;

    const value = await adapter.get("test:nonexistent");
    expect(value).toBeUndefined();
  });

  it("should invalidate a single key", async () => {
    if (!redisAvailable) return;

    await adapter.set("test:key1", "value1");
    await adapter.invalidate("test:key1");
    const value = await adapter.get("test:key1");
    expect(value).toBeUndefined();
  });

  it("should invalidate keys by prefix", async () => {
    if (!redisAvailable) return;

    await adapter.set("test:users:1", { id: 1 });
    await adapter.set("test:users:2", { id: 2 });
    await adapter.set("test:posts:1", { id: 1 });

    await adapter.invalidateAll("test:users");

    expect(await adapter.get("test:users:1")).toBeUndefined();
    expect(await adapter.get("test:users:2")).toBeUndefined();
    expect(await adapter.get("test:posts:1")).toEqual({ id: 1 });
  });

  it("should respect TTL", async () => {
    if (!redisAvailable) return;

    await adapter.set("test:ttl-key", "value", 100); // 100ms TTL

    const value1 = await adapter.get("test:ttl-key");
    expect(value1).toBe("value");

    await wait(150);

    const value2 = await adapter.get("test:ttl-key");
    expect(value2).toBeUndefined();
  });
});

describe("Custom Test Adapter", () => {
  class TestCacheAdapter implements CacheAdapter {
    private store = new Map<string, any>();
    private timers = new Map<string, NodeJS.Timeout>();

    async get<T = void>(key: string): Promise<T> {
      return this.store.get(key);
    }

    async set<T = any>(key: string, data: T, ttl?: number): Promise<void> {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.timers.delete(key);
      }

      this.store.set(key, data);

      if (ttl) {
        const timer = setTimeout(() => {
          this.store.delete(key);
          this.timers.delete(key);
        }, ttl);
        this.timers.set(key, timer);
      }
    }

    async invalidate(key: string): Promise<void> {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.timers.delete(key);
      }
      this.store.delete(key);
    }

    async invalidateAll(prefix: string): Promise<void> {
      const keys = Array.from(this.store.keys());
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          await this.invalidate(key);
        }
      }
    }

    cleanup() {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.store.clear();
      this.timers.clear();
    }
  }

  let adapter: TestCacheAdapter;

  beforeEach(() => {
    adapter = new TestCacheAdapter();
  });

  afterEach(() => {
    adapter.cleanup();
  });

  it("should implement CacheAdapter interface", () => {
    expect(adapter).toHaveProperty("get");
    expect(adapter).toHaveProperty("set");
    expect(adapter).toHaveProperty("invalidate");
    expect(adapter).toHaveProperty("invalidateAll");
  });

  it("should set and get a value", async () => {
    await adapter.set("key1", "value1");
    const value = await adapter.get<string>("key1");
    expect(value).toBe("value1");
  });

  it("should handle complex objects", async () => {
    const complex = {
      user: { id: 1, name: "Test" },
      posts: [{ id: 1, title: "Post 1" }],
      meta: { count: 100 },
    };
    await adapter.set("complex", complex);
    const retrieved = await adapter.get<typeof complex>("complex");
    expect(retrieved).toEqual(complex);
  });

  it("should return undefined for missing keys", async () => {
    const value = await adapter.get("nonexistent");
    expect(value).toBeUndefined();
  });

  it("should invalidate a single key", async () => {
    await adapter.set("key1", "value1");
    await adapter.invalidate("key1");
    const value = await adapter.get("key1");
    expect(value).toBeUndefined();
  });

  it("should invalidate keys by prefix", async () => {
    await adapter.set("cache:users:1", { id: 1 });
    await adapter.set("cache:users:2", { id: 2 });
    await adapter.set("cache:posts:1", { id: 1 });

    await adapter.invalidateAll("cache:users");

    expect(await adapter.get("cache:users:1")).toBeUndefined();
    expect(await adapter.get("cache:users:2")).toBeUndefined();
    expect(await adapter.get("cache:posts:1")).toEqual({ id: 1 });
  });

  it("should respect TTL", async () => {
    await adapter.set("ttl-key", "value", 100);

    const value1 = await adapter.get("ttl-key");
    expect(value1).toBe("value");

    await wait(150);

    const value2 = await adapter.get("ttl-key");
    expect(value2).toBeUndefined();
  });
});
