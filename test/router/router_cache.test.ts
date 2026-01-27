import { describe, it, expect, beforeEach } from "vitest";
import { Router } from "../../src/server/router/router.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

describe("Router - Static Route Cache", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should use O(1) cache for static routes", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/users", handler);
    router.get("/users/profile", handler);

    // First lookup - should populate internal structures
    const result1 = router.find("GET", "/users");
    expect(result1).not.toBeNull();
    expect(result1!.handler).toBe(handler);
    expect(result1!.params).toEqual({});

    // Second lookup - should hit cache
    const result2 = router.find("GET", "/users");
    expect(result2).not.toBeNull();
    expect(result2!.handler).toBe(handler);
    expect(result2!.params).toEqual({});

    // Verify cache works for nested static routes
    const result3 = router.find("GET", "/users/profile");
    expect(result3).not.toBeNull();
    expect(result3!.handler).toBe(handler);
  });

  it("should fall back to tree traversal for dynamic routes", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/users/:id", handler);

    const result = router.find("GET", "/users/123");
    expect(result).not.toBeNull();
    expect(result!.handler).toBe(handler);
    expect(result!.params).toEqual({ id: "123" });
  });

  it("should handle cache invalidation when updating static routes", () => {
    const handler1 = (req: Request, res: Response) => {};
    const handler2 = (req: Request, res: Response) => {};

    router.get("/api/test", handler1);
    const result1 = router.find("GET", "/api/test");
    expect(result1!.handler).toBe(handler1);

    // Update the same route
    router.get("/api/test", handler2);
    const result2 = router.find("GET", "/api/test");
    expect(result2!.handler).toBe(handler2);
  });

  it("should cache routes with different methods separately", () => {
    const getHandler = (req: Request, res: Response) => {};
    const postHandler = (req: Request, res: Response) => {};

    router.get("/api/resource", getHandler);
    router.post("/api/resource", postHandler);

    const getResult = router.find("GET", "/api/resource");
    const postResult = router.find("POST", "/api/resource");

    expect(getResult!.handler).toBe(getHandler);
    expect(postResult!.handler).toBe(postHandler);
  });

  it("should handle query strings in static route lookups", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/search", handler);

    const result = router.find("GET", "/search?q=test&page=1");
    expect(result).not.toBeNull();
    expect(result!.handler).toBe(handler);
    expect(result!.params).toEqual({});
  });

  it("should not cache routes with wildcards", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/files/*", handler);

    const result1 = router.find("GET", "/files/path/to/file.txt");
    expect(result1).not.toBeNull();
    expect(result1!.params).toEqual({ "*": "path/to/file.txt" });

    const result2 = router.find("GET", "/files/another/file.pdf");
    expect(result2).not.toBeNull();
    expect(result2!.params).toEqual({ "*": "another/file.pdf" });
  });
});

describe("Router - Param Name Handling", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should handle consistent param names across similar routes", () => {
    const userHandler = (req: Request, res: Response) => {};
    const postHandler = (req: Request, res: Response) => {};

    router.get("/users/:id", userHandler);
    router.get("/posts/:id", postHandler);

    const userResult = router.find("GET", "/users/123");
    expect(userResult).not.toBeNull();
    expect(userResult!.params).toEqual({ id: "123" });
    expect(userResult!.handler).toBe(userHandler);

    const postResult = router.find("GET", "/posts/456");
    expect(postResult).not.toBeNull();
    expect(postResult!.params).toEqual({ id: "456" });
    expect(postResult!.handler).toBe(postHandler);
  });

  it("should extract multiple param names correctly", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/users/:userId/posts/:postId", handler);

    const result = router.find("GET", "/users/123/posts/456");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({
      userId: "123",
      postId: "456",
    });
  });

  it("should handle param names with mixed static segments", () => {
    const handler = (req: Request, res: Response) => {};
    router.get("/api/v1/users/:userId/profile/:section", handler);

    const result = router.find("GET", "/api/v1/users/42/profile/settings");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({
      userId: "42",
      section: "settings",
    });
  });

  it("should prioritize static routes over param routes", () => {
    const staticHandler = (req: Request, res: Response) => {};
    const paramHandler = (req: Request, res: Response) => {};

    router.get("/users/me", staticHandler);
    router.get("/users/:id", paramHandler);

    const staticResult = router.find("GET", "/users/me");
    expect(staticResult!.handler).toBe(staticHandler);

    const paramResult = router.find("GET", "/users/123");
    expect(paramResult!.handler).toBe(paramHandler);
  });
});
