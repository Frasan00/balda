import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CacheAdapter } from "../../src/cache/cache_adapter.js";
import {
  InMemoryAdapter,
  RedisCacheAdapter,
  Server,
  buildCacheKey,
} from "../../src/index.js";
import type { MockServer } from "../../src/mock/mock_server.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Custom test adapter
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

describe("Cache Integration - InMemory", () => {
  let server: Server;
  let mockServer: MockServer;
  let adapter: InMemoryAdapter;

  beforeAll(async () => {
    adapter = new InMemoryAdapter();

    server = new Server({
      port: 3100,
      cache: {
        adapter,
      },
      controllerPatterns: ["./test/controllers/cached.{ts,js}"],
    });

    // Define inline routes
    server.get("/inline/static", { cache: { ttl: 5000 } }, (_req, res) => {
      res.json({ timestamp: Date.now(), data: "static" });
    });

    server.get("/inline/dynamic/:id", { cache: { ttl: 5000 } }, (req, res) => {
      res.json({ id: req.params.id, timestamp: Date.now() });
    });

    server.get("/inline/query", { cache: { ttl: 5000 } }, (req, res) => {
      res.json({ query: req.query, timestamp: Date.now() });
    });

    server.get(
      "/inline/custom",
      { cache: { key: "custom-static-key", ttl: 5000 } },
      (_req, res) => {
        res.json({ timestamp: Date.now() });
      },
    );

    server.get("/inline/short-ttl", { cache: { ttl: 100 } }, (_req, res) => {
      res.json({ timestamp: Date.now() });
    });

    server.get("/inline/no-cache", (_req, res) => {
      res.json({ timestamp: Date.now() });
    });

    mockServer = await server.getMockServer();
  });

  afterAll(async () => {
    await adapter.invalidateAll("cache");
  });

  it("should cache static route responses", async () => {
    const res1 = await mockServer.get("/inline/static");
    const body1 = res1.body() as any;
    expect(res1.statusCode()).toBe(200);

    const res2 = await mockServer.get("/inline/static");
    const body2 = res2.body() as any;
    expect(res2.statusCode()).toBe(200);

    // Cached response should have same timestamp
    expect(body1.timestamp).toBe(body2.timestamp);
  });

  it("should cache dynamic routes with different keys per param", async () => {
    const res1 = await mockServer.get("/inline/dynamic/1");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/inline/dynamic/1");
    const body2 = res2.body() as any;

    // Same param should return cached response
    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.id).toBe("1");

    // Add small delay to ensure different timestamp
    await wait(5);

    // Different param should return fresh response
    const res3 = await mockServer.get("/inline/dynamic/2");
    const body3 = res3.body() as any;
    expect(body3.id).toBe("2");
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should cache routes with different keys per query param", async () => {
    const res1 = await mockServer.get("/inline/query?role=admin");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/inline/query?role=admin");
    const body2 = res2.body() as any;

    // Same query should return cached response
    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.query.role).toBe("admin");

    // Add small delay to ensure different timestamp
    await wait(5);

    // Different query should return fresh response
    const res3 = await mockServer.get("/inline/query?role=user");
    const body3 = res3.body() as any;
    expect(body3.query.role).toBe("user");
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should use custom key override", async () => {
    const res1 = await mockServer.get("/inline/custom");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/inline/custom");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);

    // Verify custom key was used
    const cachedValue = await adapter.get("custom-static-key");
    expect(cachedValue).toBeDefined();
  });

  it("should respect TTL expiration", async () => {
    const res1 = await mockServer.get("/inline/short-ttl");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/inline/short-ttl");
    const body2 = res2.body() as any;

    // Should be cached
    expect(body1.timestamp).toBe(body2.timestamp);

    // Wait for TTL to expire
    await wait(150);

    const res3 = await mockServer.get("/inline/short-ttl");
    const body3 = res3.body() as any;

    // Should have fresh response
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should not cache routes without cache options", async () => {
    const res1 = await mockServer.get("/inline/no-cache");
    const body1 = res1.body() as any;

    await wait(10);

    const res2 = await mockServer.get("/inline/no-cache");
    const body2 = res2.body() as any;

    // Should have different timestamps (not cached)
    expect(body1.timestamp).not.toBe(body2.timestamp);
  });

  it("should invalidate specific cache key", async () => {
    const res1 = await mockServer.get("/inline/static");
    const body1 = res1.body() as any;

    const key = buildCacheKey("GET", "/inline/static", {}, {});
    await server.invalidateCache(key);

    const res2 = await mockServer.get("/inline/static");
    const body2 = res2.body() as any;

    // Should have fresh response after invalidation
    expect(body2.timestamp).not.toBe(body1.timestamp);
  });

  it("should invalidate cache by prefix", async () => {
    await mockServer.get("/inline/dynamic/1");
    await mockServer.get("/inline/dynamic/2");
    await mockServer.get("/inline/static");

    // Invalidate all dynamic routes
    await server.invalidateCachePrefix("cache:GET:/inline/dynamic");

    // Dynamic routes should have fresh responses
    const res1 = await mockServer.get("/inline/dynamic/1");
    const res2 = await mockServer.get("/inline/dynamic/2");

    // Static route should still be cached
    const res3 = await mockServer.get("/inline/static");

    expect(res1.body()).toBeDefined();
    expect(res2.body()).toBeDefined();
    expect(res3.body()).toBeDefined();
  });

  it("should warm up cache for static routes", async () => {
    await server.warmCache("GET", "/inline/static");

    // Verify cache is populated
    const key = buildCacheKey("GET", "/inline/static", {}, {});
    const cached = await adapter.get(key);
    expect(cached).toBeDefined();

    // Request should hit cache
    const res = await mockServer.get("/inline/static");
    const body = res.body() as any;
    expect((cached as any).body.timestamp).toBe(body.timestamp);
  });

  it("should throw error when warming non-GET route", async () => {
    await expect(server.warmCache("POST", "/inline/static")).rejects.toThrow(
      "Cache warm-up is only supported for GET routes",
    );
  });

  it("should throw error when warming route without cache options", async () => {
    await expect(server.warmCache("GET", "/inline/no-cache")).rejects.toThrow(
      "does not have cache options enabled",
    );
  });
});

describe("Cache Integration - Decorator", () => {
  let server: Server;
  let mockServer: MockServer;
  const adapter = new InMemoryAdapter();

  beforeAll(async () => {
    server = new Server({
      port: 3101,
      cache: {
        adapter,
      },
      controllerPatterns: ["./test/controllers/cached.{ts,js}"],
    });

    mockServer = await server.getMockServer();
  });

  afterAll(async () => {
    await adapter.invalidateAll("cache");
  });

  it("should cache controller route with @cache decorator", async () => {
    const res1 = await mockServer.get("/cached/profile");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/cached/profile");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.callCount).toBe(body2.callCount);
  });

  it("should cache dynamic routes with decorator", async () => {
    const res1 = await mockServer.get("/cached/user/123");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/cached/user/123");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.id).toBe("123");

    // Add small delay to ensure different timestamp
    await wait(5);

    // Different param should be separate cache entry
    const res3 = await mockServer.get("/cached/user/456");
    const body3 = res3.body() as any;
    expect(body3.id).toBe("456");
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should cache routes with query params separately", async () => {
    const res1 = await mockServer.get("/cached/search?q=test");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/cached/search?q=test");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);

    // Add small delay to ensure different timestamp
    await wait(5);

    // Different query should be separate cache entry
    const res3 = await mockServer.get("/cached/search?q=other");
    const body3 = res3.body() as any;
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should use custom key with decorator", async () => {
    const res1 = await mockServer.get("/cached/custom-key");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/cached/custom-key");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);

    // Verify custom key was used
    const cached = await adapter.get("static-custom-key");
    expect(cached).toBeDefined();
  });

  it("should not cache routes without @cache decorator", async () => {
    const res1 = await mockServer.get("/cached/no-cache");
    const body1 = res1.body() as any;

    await wait(10);

    const res2 = await mockServer.get("/cached/no-cache");
    const body2 = res2.body() as any;

    // Should have different timestamps (not cached)
    expect(body1.timestamp).not.toBe(body2.timestamp);
  });

  it("should respect TTL with decorator", async () => {
    const res1 = await mockServer.get("/cached/short-ttl");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/cached/short-ttl");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);

    await wait(150);

    const res3 = await mockServer.get("/cached/short-ttl");
    const body3 = res3.body() as any;

    expect(body3.timestamp).not.toBe(body1.timestamp);
  });
});

describe("Cache Integration - Redis", () => {
  let server: Server;
  let mockServer: MockServer;
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

      server = new Server({
        port: 3102,
        cache: {
          adapter,
        },
        controllerPatterns: ["./test/controllers/cached.{ts,js}"],
      });

      server.get("/redis/static", { cache: { ttl: 5000 } }, (_req, res) => {
        res.json({ timestamp: Date.now(), source: "redis" });
      });

      server.get("/redis/dynamic/:id", { cache: { ttl: 5000 } }, (req, res) => {
        res.json({ id: req.params.id, timestamp: Date.now() });
      });

      mockServer = await server.getMockServer();
    } catch (error) {
      console.warn(
        "Redis not available, skipping Redis tests:",
        (error as Error).message,
      );
      redisAvailable = false;
    }
  }, 5000);

  afterAll(async () => {
    if (!redisAvailable) return;
    try {
      await adapter.invalidateAll("cache");
      await adapter.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should cache responses in Redis", async () => {
    if (!redisAvailable) return;

    const res1 = await mockServer.get("/redis/static");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/redis/static");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.source).toBe("redis");
  });

  it("should cache dynamic routes in Redis", async () => {
    if (!redisAvailable) return;

    const res1 = await mockServer.get("/redis/dynamic/100");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/redis/dynamic/100");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.id).toBe("100");
  });

  it("should invalidate Redis cache", async () => {
    if (!redisAvailable) return;

    const res1 = await mockServer.get("/redis/static");
    const body1 = res1.body() as any;

    const key = buildCacheKey("GET", "/redis/static", {}, {});
    await server.invalidateCache(key);

    const res2 = await mockServer.get("/redis/static");
    const body2 = res2.body() as any;

    expect(body2.timestamp).not.toBe(body1.timestamp);
  });
});

describe("Cache Integration - Custom Adapter", () => {
  let server: Server;
  let mockServer: MockServer;
  const adapter = new TestCacheAdapter();

  beforeAll(async () => {
    server = new Server({
      port: 3103,
      cache: {
        adapter,
      },
      controllerPatterns: ["./test/controllers/cached.{ts,js}"],
    });

    server.get("/custom/static", { cache: { ttl: 5000 } }, (_req, res) => {
      res.json({ timestamp: Date.now(), adapter: "custom" });
    });

    server.get("/custom/dynamic/:id", { cache: { ttl: 5000 } }, (req, res) => {
      res.json({ id: req.params.id, timestamp: Date.now() });
    });

    mockServer = await server.getMockServer();
  });

  afterAll(() => {
    adapter.cleanup();
  });

  it("should cache responses with custom adapter", async () => {
    const res1 = await mockServer.get("/custom/static");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/custom/static");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.adapter).toBe("custom");
  });

  it("should cache dynamic routes with custom adapter", async () => {
    const res1 = await mockServer.get("/custom/dynamic/999");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/custom/dynamic/999");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.id).toBe("999");
  });

  it("should invalidate custom adapter cache", async () => {
    const res1 = await mockServer.get("/custom/static");
    const body1 = res1.body() as any;

    const key = buildCacheKey("GET", "/custom/static", {}, {});
    await adapter.invalidate(key);

    // Add small delay to ensure different timestamp
    await wait(5);

    const res2 = await mockServer.get("/custom/static");
    const body2 = res2.body() as any;

    expect(body2.timestamp).not.toBe(body1.timestamp);
  });
});

describe("Cache - Response Headers and Status", () => {
  let server: Server;
  let mockServer: MockServer;
  const adapter = new InMemoryAdapter();

  beforeAll(async () => {
    server = new Server({
      port: 3104,
      cache: {
        adapter,
      },
    });

    server.get("/headers", { cache: { ttl: 5000 } }, (_req, res) => {
      res.setHeader("X-Custom", "test-value");
      res.status(200);
      res.json({ data: "with-headers" });
    });

    server.get("/status/201", { cache: { ttl: 5000 } }, (_req, res) => {
      res.status(201);
      res.json({ created: true });
    });

    mockServer = await server.getMockServer();
  });

  afterAll(async () => {
    await adapter.invalidateAll("cache");
  });

  it("should cache custom headers", async () => {
    const res1 = await mockServer.get("/headers");
    const headers1 = res1.headers();

    const res2 = await mockServer.get("/headers");
    const headers2 = res2.headers();

    expect(headers1["X-Custom"]).toBe("test-value");
    expect(headers2["X-Custom"]).toBe("test-value");
  });

  it("should cache custom status codes", async () => {
    const res1 = await mockServer.get("/status/201");
    expect(res1.statusCode()).toBe(201);

    const res2 = await mockServer.get("/status/201");
    expect(res2.statusCode()).toBe(201);

    const body1 = res1.body() as any;
    const body2 = res2.body() as any;
    expect(body1.created).toBe(body2.created);
  });
});

describe("Cache - buildCacheKey utility", () => {
  it("should export buildCacheKey for manual usage", () => {
    const key = buildCacheKey(
      "GET",
      "/users/:id",
      { id: "123" },
      { sort: "asc" },
    );
    expect(key).toBe('cache:GET:/users/:id:{"id":"123"}:{"sort":"asc"}');
  });

  it("should allow users to build keys for invalidation", () => {
    const key1 = buildCacheKey("GET", "/posts/:id", { id: "1" }, {});
    const key2 = buildCacheKey("GET", "/posts/:id", { id: "2" }, {});

    expect(key1).toContain('"id":"1"');
    expect(key2).toContain('"id":"2"');
    expect(key1).not.toBe(key2);
  });
});

describe("Cache - No Adapter Configured", () => {
  let server: Server;
  let mockServer: MockServer;

  beforeAll(async () => {
    // Server without cache adapter
    server = new Server({
      port: 3105,
    });

    server.get("/no-adapter", { cache: { ttl: 5000 } }, (_req, res) => {
      res.json({ timestamp: Date.now() });
    });

    mockServer = await server.getMockServer();
  });

  it("should not cache when adapter is not configured", async () => {
    const res1 = await mockServer.get("/no-adapter");
    const body1 = res1.body() as any;

    await wait(10);

    const res2 = await mockServer.get("/no-adapter");
    const body2 = res2.body() as any;

    // Should have different timestamps (not cached)
    expect(body1.timestamp).not.toBe(body2.timestamp);
  });

  it("should not throw error when cache options set but no adapter", async () => {
    const res = await mockServer.get("/no-adapter");
    expect(res.statusCode()).toBe(200);
  });
});

describe("Cache - Edge Cases", () => {
  let server: Server;
  let mockServer: MockServer;
  const adapter = new InMemoryAdapter();

  beforeAll(async () => {
    server = new Server({
      port: 3106,
      cache: {
        adapter,
      },
    });

    server.get("/empty-query", { cache: { ttl: 5000 } }, (req, res) => {
      res.json({ query: req.query, timestamp: Date.now() });
    });

    server.get(
      "/complex/:userId/posts/:postId",
      { cache: { ttl: 5000 } },
      (req, res) => {
        res.json({
          userId: req.params.userId,
          postId: req.params.postId,
          timestamp: Date.now(),
        });
      },
    );

    mockServer = await server.getMockServer();
  });

  afterAll(async () => {
    await adapter.invalidateAll("cache");
  });

  it("should handle routes with no query params", async () => {
    const res1 = await mockServer.get("/empty-query");
    const res2 = await mockServer.get("/empty-query");

    const body1 = res1.body() as any;
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
  });

  it("should handle routes with empty query string", async () => {
    const res1 = await mockServer.get("/empty-query?");
    const res2 = await mockServer.get("/empty-query?");

    const body1 = res1.body() as any;
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
  });

  it("should cache complex multi-param routes", async () => {
    const res1 = await mockServer.get("/complex/user123/posts/post456");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/complex/user123/posts/post456");
    const body2 = res2.body() as any;

    expect(body1.timestamp).toBe(body2.timestamp);
    expect(body1.userId).toBe("user123");
    expect(body1.postId).toBe("post456");

    // Add small delay to ensure different timestamp
    await wait(5);

    // Different params should create new cache
    const res3 = await mockServer.get("/complex/user999/posts/post111");
    const body3 = res3.body() as any;
    expect(body3.userId).toBe("user999");
    expect(body3.postId).toBe("post111");
    expect(body3.timestamp).not.toBe(body1.timestamp);
  });

  it("should handle query param order independence", async () => {
    const res1 = await mockServer.get("/empty-query?a=1&b=2");
    const body1 = res1.body() as any;

    const res2 = await mockServer.get("/empty-query?b=2&a=1");
    const body2 = res2.body() as any;

    // Same params, different order should hit same cache
    expect(body1.timestamp).toBe(body2.timestamp);
  });
});
