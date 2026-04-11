import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_STATUS_HEADER,
  CacheStatus,
  DEFAULT_CACHE_OPTIONS,
} from "../../src/cache/cache.constants.js";
import {
  getCacheService,
  initCacheService,
} from "../../src/cache/cache.registry.js";
import { RedisCacheProvider } from "../../src/cache/providers/redis_cache_provider.js";
import type { MockServer } from "../../src/mock/mock_server.js";
import { Server } from "../../src/server/server.js";
import { getCallCount, resetCallCount } from "../controllers/cache_counter.js";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "root";

/** Flush all keys owned by a provider via its scan + delMany. */
async function flushProvider(provider: RedisCacheProvider): Promise<void> {
  for await (const keys of provider.scan("*")) {
    if (keys.length > 0) {
      await provider.delMany(keys);
    }
  }
}

// ─── Controller-based cache tests ────────────────────────────────────────────
describe("Cache (Redis) — @cache() decorator (controller)", () => {
  let mockServer: MockServer;
  let redisProvider: RedisCacheProvider;

  beforeAll(async () => {
    redisProvider = new RedisCacheProvider({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      keyPrefix: "test:ctrl:",
    });

    // Initialize cache service standalone
    initCacheService(redisProvider, { ...DEFAULT_CACHE_OPTIONS });

    const server = new Server({
      port: 4200,
      host: "localhost",
      plugins: {
        bodyParser: { json: {} },
      },
      controllerPatterns: ["./test/controllers/cache_test_controller.{ts,js}"],
    });

    mockServer = server.getMockServer();
  });

  afterAll(async () => {
    await redisProvider.disconnect();
  });

  beforeEach(async () => {
    resetCallCount();
    await flushProvider(redisProvider);
  });

  it("second identical request is a HIT and handler is NOT called again", async () => {
    await mockServer.get("/cache-test/items");
    resetCallCount();

    const res = await mockServer.get("/cache-test/items");

    expect(res.statusCode()).toBe(200);
    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
    expect((res.body() as any).items).toEqual(["a", "b", "c"]);
  });

  it("same route param hits cache on repeat", async () => {
    await mockServer.get("/cache-test/items/42");
    resetCallCount();

    const res = await mockServer.get("/cache-test/items/42");

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
    expect((res.body() as any).id).toBe("42");
  });

  it("same body hits cache on repeat (include.body)", async () => {
    await mockServer.post("/cache-test/search", { body: { q: "vitest" } });
    resetCallCount();

    const res = await mockServer.post("/cache-test/search", {
      body: { q: "vitest" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
  });

  it("same query string hits cache on repeat (include.query)", async () => {
    await mockServer.get("/cache-test/filtered", {
      query: { status: "pending" },
    });
    resetCallCount();

    const res = await mockServer.get("/cache-test/filtered", {
      query: { status: "pending" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
  });
});

// ─── Router inline cache tests ────────────────────────────────────────────────
describe("Cache (Redis) — inline router config", () => {
  let mockServer: MockServer;
  let redisProvider: RedisCacheProvider;
  let routerCallCount = 0;

  beforeAll(async () => {
    redisProvider = new RedisCacheProvider({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      keyPrefix: "test:inline:",
    });

    // Initialize cache service standalone
    initCacheService(redisProvider, { ...DEFAULT_CACHE_OPTIONS });

    const server = new Server({
      port: 4201,
      host: "localhost",
    });

    mockServer = server.getMockServer();

    server.router.get(
      "/redis-inline-cache/products",
      { cache: { ttl: 60 } },
      (_req, res) => {
        routerCallCount++;
        res.json({ products: ["p1", "p2"], callCount: routerCallCount });
      },
    );

    server.router.get(
      "/redis-inline-cache/products/:id",
      { cache: { ttl: 60 } },
      (req, res) => {
        routerCallCount++;
        res.json({ id: (req as any).params.id, callCount: routerCallCount });
      },
    );

    server.router.get(
      "/redis-inline-cache/search",
      { cache: { ttl: 60, include: { query: true } } },
      (req, res) => {
        routerCallCount++;
        res.json({ query: (req as any).query, callCount: routerCallCount });
      },
    );

    server.router.get(
      "/redis-inline-cache/headers",
      { cache: { ttl: 60, include: { headers: ["x-tenant-id"] } } },
      (req, res) => {
        routerCallCount++;
        res.json({ callCount: routerCallCount });
      },
    );
  });

  afterAll(async () => {
    await redisProvider.disconnect();
  });

  beforeEach(async () => {
    routerCallCount = 0;
    await flushProvider(redisProvider);
  });

  it("first request is a MISS and handler is called", async () => {
    const res = await mockServer.get("/redis-inline-cache/products");

    expect(res.statusCode()).toBe(200);
    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(1);
  });

  it("second identical request is a HIT and handler is NOT called", async () => {
    await mockServer.get("/redis-inline-cache/products");
    routerCallCount = 0;

    const res = await mockServer.get("/redis-inline-cache/products");

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
    expect((res.body() as any).products).toEqual(["p1", "p2"]);
  });

  it("different route params produce different cache keys", async () => {
    const res1 = await mockServer.get("/redis-inline-cache/products/10");
    const res2 = await mockServer.get("/redis-inline-cache/products/20");

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(2);
  });

  it("query string variations produce different cache keys", async () => {
    const res1 = await mockServer.get("/redis-inline-cache/search", {
      query: { q: "alpha" },
    });
    const res2 = await mockServer.get("/redis-inline-cache/search", {
      query: { q: "beta" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
  });

  it("same query string hits cache on repeat", async () => {
    await mockServer.get("/redis-inline-cache/search", {
      query: { q: "gamma" },
    });
    routerCallCount = 0;

    const res = await mockServer.get("/redis-inline-cache/search", {
      query: { q: "gamma" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
  });

  it("different header values produce different cache keys (include.headers)", async () => {
    const res1 = await mockServer.get("/redis-inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-A" },
    });
    const res2 = await mockServer.get("/redis-inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-B" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(2);
  });

  it("same header value hits cache on repeat", async () => {
    await mockServer.get("/redis-inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-C" },
    });
    routerCallCount = 0;

    const res = await mockServer.get("/redis-inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-C" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
  });
});

// ─── CacheService invalidation via tag ───────────────────────────────────────
describe("Cache (Redis) — invalidation via getCacheService", () => {
  let mockServer: MockServer;
  let redisProvider: RedisCacheProvider;
  let embedCallCount = 0;

  beforeAll(async () => {
    redisProvider = new RedisCacheProvider({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      keyPrefix: "test:inv:",
    });

    // Initialize cache service standalone
    initCacheService(redisProvider, { ...DEFAULT_CACHE_OPTIONS });

    const server = new Server({
      port: 4202,
      host: "localhost",
    });

    mockServer = server.getMockServer();

    server.router.get(
      "/redis-inv/data",
      { cache: { ttl: 60, tags: ["data"] } },
      (_req, res) => {
        embedCallCount++;
        res.json({ value: "fresh", callCount: embedCallCount });
      },
    );
  });

  afterAll(async () => {
    await redisProvider.disconnect();
  });

  beforeEach(async () => {
    embedCallCount = 0;
    await flushProvider(redisProvider);
  });

  it("invalidating a tag clears the cached entry", async () => {
    // Prime the cache
    const first = await mockServer.get("/redis-inv/data");
    expect(first.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    embedCallCount = 0;

    // Verify HIT
    const cached = await mockServer.get("/redis-inv/data");
    expect(cached.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(embedCallCount).toBe(0);

    // Invalidate via CacheService (global singleton set during bootstrap)
    const cacheService = getCacheService();
    expect(cacheService).not.toBeNull();
    await cacheService!.invalidate(["data"]);
    embedCallCount = 0;

    // Should be a MISS again
    const afterInvalidation = await mockServer.get("/redis-inv/data");
    expect(afterInvalidation.headers()[CACHE_STATUS_HEADER]).toBe(
      CacheStatus.Miss,
    );
    expect(embedCallCount).toBe(1);
  });
});
