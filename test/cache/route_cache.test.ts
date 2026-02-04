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

  it("should generate same keys for different query params by default (includeQuery: false)", () => {
    const key1 = buildCacheKey("GET", "/users", {}, { role: "admin" });
    const key2 = buildCacheKey("GET", "/users", {}, { role: "user" });
    expect(key1).toBe(key2);
    expect(key1).not.toContain("role");
  });

  it("should generate different keys for different query params when includeQuery is true", () => {
    const key1 = buildCacheKey(
      "GET",
      "/users",
      {},
      { role: "admin" },
      { includeQuery: true },
    );
    const key2 = buildCacheKey(
      "GET",
      "/users",
      {},
      { role: "user" },
      { includeQuery: true },
    );
    expect(key1).not.toBe(key2);
    expect(key1).toContain('"role":"admin"');
    expect(key2).toContain('"role":"user"');
  });

  it("should generate same keys regardless of query param order when includeQuery is true", () => {
    const key1 = buildCacheKey(
      "GET",
      "/search",
      {},
      { q: "test", page: "1" },
      { includeQuery: true },
    );
    const key2 = buildCacheKey(
      "GET",
      "/search",
      {},
      { page: "1", q: "test" },
      { includeQuery: true },
    );
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

  it("should combine params and query in key when includeQuery is true", () => {
    const key = buildCacheKey(
      "GET",
      "/users/:id",
      { id: "123" },
      { include: "posts", sort: "desc" },
      { includeQuery: true },
    );
    expect(key).toContain("cache:GET:/users/:id");
    expect(key).toContain('"id":"123"');
    expect(key).toContain('"include":"posts"');
    expect(key).toContain('"sort":"desc"');
  });

  it("should handle empty params and query with default options", () => {
    const key = buildCacheKey("GET", "/static", {}, {});
    expect(key).toBe("cache:GET:/static:{}");
  });

  it("should include headers in key when includeHeaders is true", () => {
    const key1 = buildCacheKey(
      "GET",
      "/users",
      {},
      {},
      { includeHeaders: true, headers: { "accept-language": "en" } },
    );
    const key2 = buildCacheKey(
      "GET",
      "/users",
      {},
      {},
      { includeHeaders: true, headers: { "accept-language": "fr" } },
    );
    expect(key1).not.toBe(key2);
    expect(key1).toContain('"accept-language":"en"');
    expect(key2).toContain('"accept-language":"fr"');
  });

  it("should generate same keys regardless of header order when includeHeaders is true", () => {
    const key1 = buildCacheKey(
      "GET",
      "/users",
      {},
      {},
      {
        includeHeaders: true,
        headers: { "accept-language": "en", "user-agent": "test" },
      },
    );
    const key2 = buildCacheKey(
      "GET",
      "/users",
      {},
      {},
      {
        includeHeaders: true,
        headers: { "user-agent": "test", "accept-language": "en" },
      },
    );
    expect(key1).toBe(key2);
  });

  it("should not include headers in key when includeHeaders is false or omitted", () => {
    const key1 = buildCacheKey("GET", "/users", {}, {});
    const key2 = buildCacheKey(
      "GET",
      "/users",
      {},
      {},
      { includeHeaders: false },
    );
    expect(key1).toBe(key2);
    expect(key1).not.toContain("accept-language");
  });

  it("should support combining includeQuery and includeHeaders", () => {
    const key = buildCacheKey(
      "GET",
      "/search",
      {},
      { q: "test" },
      {
        includeQuery: true,
        includeHeaders: true,
        headers: { "accept-language": "en" },
      },
    );
    expect(key).toContain('"q":"test"');
    expect(key).toContain('"accept-language":"en"');
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

  it("should store includeQuery and includeHeaders options", () => {
    const handler = (req: Request, res: Response) => {};
    router.get(
      "/with-options",
      { cache: { ttl: 5000, includeQuery: true, includeHeaders: true } },
      handler,
    );

    const match = router.find("GET", "/with-options");
    expect(match).not.toBeNull();
    expect(match!.cacheOptions).toEqual({
      ttl: 5000,
      includeQuery: true,
      includeHeaders: true,
    });
  });
});
