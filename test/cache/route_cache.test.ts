import { beforeEach, describe, expect, it } from "vitest";
import { buildCacheKey } from "../../src/cache/route_cache.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";
import { Router } from "../../src/server/router/router.js";

describe("buildCacheKey", () => {
  it("should generate deterministic keys for static routes", () => {
    const key1 = buildCacheKey("GET", "/users", {}, {});
    const key2 = buildCacheKey("GET", "/users", {}, {});
    expect(key1).toBe(key2);
    expect(key1).toContain("cache:GET:/users");
  });

  it("should generate different keys for different params", () => {
    const key1 = buildCacheKey("GET", "/users/:id", { id: "1" }, {});
    const key2 = buildCacheKey("GET", "/users/:id", { id: "2" }, {});
    expect(key1).not.toBe(key2);
    expect(key1).toContain('"id":"1"');
    expect(key2).toContain('"id":"2"');
  });

  it("should generate different keys for different query params", () => {
    const key1 = buildCacheKey("GET", "/users", {}, { role: "admin" });
    const key2 = buildCacheKey("GET", "/users", {}, { role: "user" });
    expect(key1).not.toBe(key2);
    expect(key1).toContain('"role":"admin"');
    expect(key2).toContain('"role":"user"');
  });

  it("should generate same keys regardless of query param order", () => {
    const key1 = buildCacheKey("GET", "/search", {}, { q: "test", page: "1" });
    const key2 = buildCacheKey("GET", "/search", {}, { page: "1", q: "test" });
    expect(key1).toBe(key2);
  });

  it("should generate same keys regardless of param order", () => {
    const key1 = buildCacheKey(
      "GET",
      "/posts/:postId/comments/:commentId",
      { postId: "1", commentId: "2" },
      {},
    );
    const key2 = buildCacheKey(
      "GET",
      "/posts/:postId/comments/:commentId",
      { commentId: "2", postId: "1" },
      {},
    );
    expect(key1).toBe(key2);
  });

  it("should combine params and query in key", () => {
    const key = buildCacheKey(
      "GET",
      "/users/:id",
      { id: "123" },
      { include: "posts", sort: "desc" },
    );
    expect(key).toContain("cache:GET:/users/:id");
    expect(key).toContain('"id":"123"');
    expect(key).toContain('"include":"posts"');
    expect(key).toContain('"sort":"desc"');
  });

  it("should handle empty params and query", () => {
    const key = buildCacheKey("GET", "/static", {}, {});
    expect(key).toBe("cache:GET:/static:{}:{}");
  });
});

describe("Router - Cache Options Storage", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should store cache options on GET routes", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/cached", { cache: { ttl: 5000 } }, handler);

    const match = router.find("GET", "/cached");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({ ttl: 5000 });
    expect(match!.path).toBe("/cached");
  });

  it("should store custom key override", () => {
    const handler = (req: Request, res: Response) => {};
    router.get(
      "/custom",
      { cache: { key: "my-custom-key", ttl: 3000 } },
      handler,
    );

    const match = router.find("GET", "/custom");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({ key: "my-custom-key", ttl: 3000 });
  });

  it("should store cache options for dynamic routes", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/users/:id", { cache: { ttl: 5000 } }, handler);

    const match = router.find("GET", "/users/123");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({ ttl: 5000 });
    expect(match!.path).toBe("/users/:id");
    expect(match!.params).toEqual({ id: "123" });
  });

  it("should not have cache options when not specified", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/no-cache", handler);

    const match = router.find("GET", "/no-cache");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toBeUndefined();
  });

  it("should throw when cache options provided on non-GET route", () => {
    const handler = (req: Request, res: Response) => {};

    expect(() => {
      (router as any).addOrUpdate(
        "POST",
        "/users",
        [],
        handler,
        undefined,
        undefined,
        { ttl: 5000 },
      );
    }).toThrow("Cache options are only allowed on GET routes");
  });

  it("should store path pattern for cache key generation", () => {
    const handler = (req: Request, res: Response) => {};
    router.get(
      "/posts/:postId/comments/:commentId",
      { cache: { ttl: 5000 } },
      handler,
    );

    const match = router.find("GET", "/posts/1/comments/2");
    expect(match).not.toBeNull();
    expect(match!.path).toBe("/posts/:postId/comments/:commentId");
    expect(match!.params).toEqual({ postId: "1", commentId: "2" });
  });

  it("should handle query strings in path lookups", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/search", { cache: { ttl: 5000 } }, handler);

    const match = router.find("GET", "/search?q=test&page=1");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({ ttl: 5000 });
    expect(match!.path).toBe("/search");
  });
});

describe("Router - Cache with Middlewares and Validation", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should combine cache options with middlewares", () => {
    const middleware = async (req: Request, res: Response, next: any) => next();
    const handler = (req: Request, res: Response) => {};

    router.get(
      "/with-middleware",
      { middlewares: [middleware], cache: { ttl: 5000 } },
      handler,
    );

    const match = router.find("GET", "/with-middleware");
    expect(match).not.toBeNull();
    expect(match!.middleware).toHaveLength(1);
    expect(match!.cacheOptions).toEqual({ ttl: 5000 });
  });

  it("should combine cache options with validation schemas", () => {
    const handler = (req: Request, res: Response) => {};
    const querySchema = {
      type: "object",
      properties: { page: { type: "string" } },
    };

    router.get(
      "/with-validation",
      { query: querySchema, cache: { ttl: 5000 } },
      handler,
    );

    const match = router.find("GET", "/with-validation");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({ ttl: 5000 });
  });
});

describe("Router - Cache with Groups", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should apply cache options in route groups", () => {
    const handler = (req: Request, res: Response) => {};

    router.group("/api", (r) => {
      r.get("/cached", { cache: { ttl: 5000 } }, handler);
      r.get("/not-cached", handler);
    });

    const cached = router.find("GET", "/api/cached");
    expect(cached!.cacheOptions).toEqual({ ttl: 5000 });

    const notCached = router.find("GET", "/api/not-cached");
    expect(notCached!.cacheOptions).toBeUndefined();
  });
});
