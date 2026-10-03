import { beforeAll, describe, expect, it } from "vitest";
// Imported for its side effect before any cache service exists, which is what a controller
// imported ahead of `initCacheService()` looks like — the service must still be picked up.
import "./controllers/cache_test_controller.js";
import {
  CACHE_STATUS_HEADER,
  CacheStatus,
  DEFAULT_CACHE_OPTIONS,
} from "../../src/cache/cache.constants.js";
import { initCacheService } from "../../src/cache/cache.registry.js";
import { MemoryCacheProvider } from "../../src/cache/providers/memory_cache_provider.js";
import type { MockServer } from "../../src/mock/mock_server.js";
import { Server } from "../../src/server/server.js";
import { getCallCount, resetCallCount } from "./controllers/cache_counter.js";

describe("Cache — @cache() route registered before initCacheService()", () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    initCacheService(new MemoryCacheProvider(), { ...DEFAULT_CACHE_OPTIONS });

    const server = new Server({
      port: 4300,
      host: "localhost",
      controllerPatterns: [
        "./test/cache/controllers/cache_test_controller.{ts,js}",
      ],
    });

    mockServer = server.getMockServer();
  });

  it("caches once the service is initialized", async () => {
    const first = await mockServer.get("/cache-test/items");

    expect(first.statusCode()).toBe(200);
    expect(first.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Miss);

    resetCallCount();

    const second = await mockServer.get("/cache-test/items");

    expect(second.headers()[CACHE_STATUS_HEADER]).toBe(CacheStatus.Hit);
    expect(getCallCount()).toBe(0);
  });
});
