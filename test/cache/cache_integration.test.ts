import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Server } from "../../src/server/server.js";
import { MemoryCacheProvider } from "../../src/cache/providers/memory_cache_provider.js";
import { getCacheService } from "../../src/cache/cache.registry.js";
import {
  CACHE_STATUS_HEADER,
  CacheStatus,
} from "../../src/cache/cache.constants.js";
import { getCallCount, resetCallCount } from "../controllers/cache_counter.js";
import type { MockServer } from "../../src/mock/mock_server.js";

// ─── Shared memory provider so we can reset it between tests ────────────────
const memoryProvider = new MemoryCacheProvider();

// ─── Controller-based cache tests ────────────────────────────────────────────
describe("Cache — @cache() decorator (controller)", () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    const server = new Server({
      port: 4100,
      host: "localhost",
      cache: {
        provider: memoryProvider,
      },
      plugins: {
        bodyParser: { json: {} },
      },
      controllerPatterns: ["./test/controllers/cache_test_controller.{ts,js}"],
    });

    mockServer = await server.getMockServer();
  });

  beforeEach(() => {
    resetCallCount();
  });

  it("first request is a MISS and handler is called", async () => {
    const res = await mockServer.get("/cache-test/items");

    expect(res.statusCode()).toBe(200);
    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(getCallCount()).toBe(1);
  });

  it("second identical request is a HIT and handler is NOT called again", async () => {
    // Prime the cache
    await mockServer.get("/cache-test/items");
    resetCallCount();

    const res = await mockServer.get("/cache-test/items");

    expect(res.statusCode()).toBe(200);
    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
    expect((res.body() as any).items).toEqual(["a", "b", "c"]);
  });

  it("different route params produce different cache keys", async () => {
    const res1 = await mockServer.get("/cache-test/items/1");
    const res2 = await mockServer.get("/cache-test/items/2");

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(getCallCount()).toBe(2);
  });

  it("same route param hits cache on repeat", async () => {
    await mockServer.get("/cache-test/items/42");
    resetCallCount();

    const res = await mockServer.get("/cache-test/items/42");

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
    expect((res.body() as any).id).toBe("42");
  });

  it("different bodies produce different cache keys (include.body)", async () => {
    const res1 = await mockServer.post("/cache-test/search", {
      body: { q: "foo" },
    });
    const res2 = await mockServer.post("/cache-test/search", {
      body: { q: "bar" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(getCallCount()).toBe(2);
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

  it("different query strings produce different cache keys (include.query)", async () => {
    const res1 = await mockServer.get("/cache-test/filtered", {
      query: { status: "active" },
    });
    const res2 = await mockServer.get("/cache-test/filtered", {
      query: { status: "inactive" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(getCallCount()).toBe(2);
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
describe("Cache — inline router config", () => {
  let mockServer: MockServer;
  let routerCallCount = 0;

  beforeAll(async () => {
    const inlineProvider = new MemoryCacheProvider();

    const server = new Server({
      port: 4101,
      host: "localhost",
      cache: {
        provider: inlineProvider,
      },
    });

    // getMockServer() initializes the cache registry, so routes added
    // to server.router afterwards can resolve getCacheService() correctly.
    mockServer = await server.getMockServer();

    server.router.get(
      "/inline-cache/products",
      {
        cache: { ttl: 60 },
      },
      (_req, res) => {
        routerCallCount++;
        res.json({ products: ["p1", "p2"], callCount: routerCallCount });
      },
    );

    server.router.get(
      "/inline-cache/products/:id",
      {
        cache: { ttl: 60 },
      },
      (req, res) => {
        routerCallCount++;
        res.json({ id: (req as any).params.id, callCount: routerCallCount });
      },
    );

    server.router.get(
      "/inline-cache/search",
      {
        cache: {
          ttl: 60,
          include: { query: true },
        },
      },
      (req, res) => {
        routerCallCount++;
        res.json({ query: (req as any).query, callCount: routerCallCount });
      },
    );

    server.router.get(
      "/inline-cache/headers",
      {
        cache: {
          ttl: 60,
          include: { headers: ["x-tenant-id"] },
        },
      },
      (req, res) => {
        routerCallCount++;
        res.json({ callCount: routerCallCount });
      },
    );
  });

  beforeEach(() => {
    routerCallCount = 0;
  });

  it("first request is a MISS and handler is called", async () => {
    const res = await mockServer.get("/inline-cache/products");

    expect(res.statusCode()).toBe(200);
    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(1);
  });

  it("second identical request is a HIT and handler is NOT called", async () => {
    await mockServer.get("/inline-cache/products");
    routerCallCount = 0;

    const res = await mockServer.get("/inline-cache/products");

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
    expect((res.body() as any).products).toEqual(["p1", "p2"]);
  });

  it("different route params produce different cache keys", async () => {
    const res1 = await mockServer.get("/inline-cache/products/10");
    const res2 = await mockServer.get("/inline-cache/products/20");

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(2);
  });

  it("query string variations produce different cache keys", async () => {
    const res1 = await mockServer.get("/inline-cache/search", {
      query: { q: "alpha" },
    });
    const res2 = await mockServer.get("/inline-cache/search", {
      query: { q: "beta" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
  });

  it("same query string hits cache on repeat", async () => {
    await mockServer.get("/inline-cache/search", { query: { q: "gamma" } });
    routerCallCount = 0;

    const res = await mockServer.get("/inline-cache/search", {
      query: { q: "gamma" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
  });

  it("different header values produce different cache keys (include.headers)", async () => {
    const res1 = await mockServer.get("/inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-A" },
    });
    const res2 = await mockServer.get("/inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-B" },
    });

    expect(res1.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(res2.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    expect(routerCallCount).toBe(2);
  });

  it("same header value hits cache on repeat", async () => {
    await mockServer.get("/inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-C" },
    });
    routerCallCount = 0;

    const res = await mockServer.get("/inline-cache/headers", {
      headers: { "x-tenant-id": "tenant-C" },
    });

    expect(res.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(routerCallCount).toBe(0);
  });
});

// ─── CacheService invalidation via embed ────────────────────────────────────
describe("Cache — invalidation via server.cache embed", () => {
  let mockServer: MockServer;
  let server: Server;
  let embedCallCount = 0;

  beforeAll(async () => {
    const inlineProvider = new MemoryCacheProvider();

    server = new Server({
      port: 4102,
      host: "localhost",
      cache: { provider: inlineProvider },
    });

    mockServer = await server.getMockServer();

    server.router.get(
      "/inv/data",
      { cache: { ttl: 60, tags: ["data"] } },
      (_req, res) => {
        embedCallCount++;
        res.json({ value: "fresh", callCount: embedCallCount });
      },
    );
  });

  beforeEach(() => {
    embedCallCount = 0;
  });

  it("invalidating a tag clears the cached entry", async () => {
    // Prime the cache
    const first = await mockServer.get("/inv/data");
    expect(first.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);
    embedCallCount = 0;

    // Verify HIT
    const cached = await mockServer.get("/inv/data");
    expect(cached.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(embedCallCount).toBe(0);

    // Invalidate via embedded CacheService
    const cacheService = getCacheService();
    expect(cacheService).not.toBeNull();
    await cacheService!.invalidate(["data"]);
    embedCallCount = 0;

    // Should be a MISS again
    const afterInvalidation = await mockServer.get("/inv/data");
    expect(afterInvalidation.headers()[CACHE_STATUS_HEADER]).toBe(
      CacheStatus.Miss,
    );
    expect(embedCallCount).toBe(1);
  });
});
