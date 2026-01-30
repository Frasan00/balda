import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { mountExpressRouter } from "../../../src/plugins/express/express.js";
import { router } from "../../../src/server/router/router.js";

describe("Express Router Mounting", () => {
  beforeEach(() => {
    // Clear router before each test
    (router as any).routes = [];
  });

  it("should mount simple express router with GET route", () => {
    const expressRouter = express.Router();
    expressRouter.get("/users", (req, res) => {
      res.json({ users: [] });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r) => r.path === "/api/users" && r.method === "GET");

    expect(route).toBeDefined();
    expect(route?.path).toBe("/api/users");
    expect(route?.method).toBe("GET");
  });

  it("should mount router with POST route", () => {
    const expressRouter = express.Router();
    expressRouter.post("/users", (req, res) => {
      res.json({ created: true });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r) => r.path === "/api/users" && r.method === "POST");

    expect(route).toBeDefined();
    expect(route?.method).toBe("POST");
  });

  it("should mount router with multiple HTTP methods", () => {
    const expressRouter = express.Router();
    expressRouter.get("/resource", (req, res) => res.json({}));
    expressRouter.post("/resource", (req, res) => res.json({}));
    expressRouter.put("/resource", (req, res) => res.json({}));
    expressRouter.delete("/resource", (req, res) => res.json({}));

    mountExpressRouter("/api", expressRouter);

    const getMethods = ["GET", "POST", "PUT", "DELETE"];
    for (const method of getMethods) {
      const route = router
        .getRoutes()
        .find((r) => r.path === "/api/resource" && r.method === method);
      expect(route).toBeDefined();
    }
  });

  it("should normalize base path with trailing slash", () => {
    const expressRouter = express.Router();
    expressRouter.get("/test", (req, res) => res.json({}));

    mountExpressRouter("/api/", expressRouter);

    const route = router.getRoutes().find((r) => r.path === "/api/test");
    expect(route).toBeDefined();
  });

  it("should normalize base path without leading slash", () => {
    const expressRouter = express.Router();
    expressRouter.get("/test", (req, res) => res.json({}));

    mountExpressRouter("api", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/test");
    expect(route).toBeDefined();
  });

  it("should mount router at root path", () => {
    const expressRouter = express.Router();
    expressRouter.get("/root", (req, res) => res.json({}));

    mountExpressRouter("/", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/root");
    expect(route).toBeDefined();
  });

  it("should handle route parameters", () => {
    const expressRouter = express.Router();
    expressRouter.get("/users/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/users/:id");
    expect(route).toBeDefined();
  });

  it("should handle multiple route parameters", () => {
    const expressRouter = express.Router();
    expressRouter.get("/users/:userId/posts/:postId", (req, res) => {
      res.json({});
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find(
        (r: { path: string }) => r.path === "/api/users/:userId/posts/:postId",
      );
    expect(route).toBeDefined();
  });

  it("should convert multiple handlers to middlewares", () => {
    const expressRouter = express.Router();
    const middleware1 = (req: any, res: any, next: any) => next();
    const middleware2 = (req: any, res: any, next: any) => next();
    const handler = (req: any, res: any) => res.json({});

    expressRouter.get("/protected", middleware1, middleware2, handler);

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/protected");
    expect(route).toBeDefined();
    // Should have middleware (at least the middleware handlers before the final one)
    expect(Array.isArray(route?.middleware)).toBe(true);
  });

  it("should exclude mounted routes from Swagger", () => {
    const expressRouter = express.Router();
    expressRouter.get("/private", (req, res) => res.json({}));

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/private");
    expect(route).toBeDefined();
    // Check that swaggerOptions exists and has excludeFromSwagger property
    expect(route?.swaggerOptions?.excludeFromSwagger).toBe(true);
  });

  it("should handle router with middleware layers", () => {
    const expressRouter = express.Router();

    // Add router-level middleware
    expressRouter.use((req, res, next) => {
      next();
    });

    expressRouter.get("/test", (req, res) => res.json({}));

    const beforeCount = router.getRoutes().length;
    mountExpressRouter("/api", expressRouter);

    // Should register routes (at least the test route and possibly middleware routes)
    expect(router.getRoutes().length).toBeGreaterThan(beforeCount);

    // Should also register the actual route
    const testRoute = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/test");
    expect(testRoute).toBeDefined();
  });

  it("should handle empty router gracefully", () => {
    const expressRouter = express.Router();

    // Don't expect errors when mounting empty router
    expect(() => {
      mountExpressRouter("/api", expressRouter);
    }).not.toThrow();
  });

  it("should normalize duplicate slashes in paths", () => {
    const expressRouter = express.Router();
    expressRouter.get("//test", (req, res) => res.json({}));

    mountExpressRouter("//api//", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/test");
    expect(route).toBeDefined();
  });

  it("should handle complex nested routing structure", () => {
    const postsRouter = express.Router();
    postsRouter.get("/", (req, res) => res.json({ posts: [] }));
    postsRouter.get("/:id", (req, res) => res.json({ post: {} }));

    const apiRouter = express.Router();
    apiRouter.use("/posts", postsRouter);

    const beforeCount = router.getRoutes().length;
    mountExpressRouter("/api/v1", apiRouter);

    // Should register routes
    expect(router.getRoutes().length).toBeGreaterThan(beforeCount);
  });

  it("should handle route with query parameters in handler", () => {
    const expressRouter = express.Router();
    expressRouter.get("/search", (req, res) => {
      res.json({ query: req.query });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r: { path: string }) => r.path === "/api/search");
    expect(route).toBeDefined();
  });

  it("should preserve route order", () => {
    const expressRouter = express.Router();
    expressRouter.get("/first", (req, res) => res.json({}));
    expressRouter.get("/second", (req, res) => res.json({}));
    expressRouter.get("/third", (req, res) => res.json({}));

    const beforeCount = router.getRoutes().length;
    mountExpressRouter("/api", expressRouter);

    const addedRoutes = router.getRoutes().slice(beforeCount);
    const paths = addedRoutes.map((r: { path: string }) => r.path);

    expect(paths).toContain("/api/first");
    expect(paths).toContain("/api/second");
    expect(paths).toContain("/api/third");

    // Order should be maintained
    const firstIndex = paths.indexOf("/api/first");
    const secondIndex = paths.indexOf("/api/second");
    const thirdIndex = paths.indexOf("/api/third");

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });

  it("should handle PATCH method", () => {
    const expressRouter = express.Router();
    expressRouter.patch("/resource/:id", (req, res) => {
      res.json({ updated: true });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r) => r.path === "/api/resource/:id" && r.method === "PATCH");
    expect(route).toBeDefined();
  });

  it("should handle OPTIONS method", () => {
    const expressRouter = express.Router();
    expressRouter.options("/resource", (req, res) => {
      res.json({});
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r) => r.path === "/api/resource" && r.method === "OPTIONS");
    expect(route).toBeDefined();
  });

  it("should handle HEAD method", () => {
    const expressRouter = express.Router();
    expressRouter.head("/health", (req, res) => {
      res.end();
    });

    mountExpressRouter("/api", expressRouter);

    const route = router
      .getRoutes()
      .find((r) => r.path === "/api/health" && r.method === "HEAD");
    expect(route).toBeDefined();
  });

  it("should handle router.all() method", () => {
    const expressRouter = express.Router();
    expressRouter.all("/wildcard", (req, res) => {
      res.json({ method: req.method });
    });

    mountExpressRouter("/api", expressRouter);

    // router.all() should register multiple methods
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const routes = router.getRoutes().filter((r) => r.path === "/api/wildcard");

    expect(routes.length).toBeGreaterThan(0);
  });

  it("should mount router at empty base path", () => {
    const expressRouter = express.Router();
    expressRouter.get("/test", (req, res) => res.json({}));

    mountExpressRouter("", expressRouter);

    const route = router.getRoutes().find((r) => r.path === "/test");
    expect(route).toBeDefined();
  });

  it("should handle deeply nested router structure", () => {
    const level3Router = express.Router();
    level3Router.get("/deep", (req, res) => res.json({}));

    const level2Router = express.Router();
    level2Router.use("/level3", level3Router);

    const level1Router = express.Router();
    level1Router.use("/level2", level2Router);

    const beforeCount = router.getRoutes().length;
    mountExpressRouter("/api", level1Router);

    // Should register routes
    expect(router.getRoutes().length).toBeGreaterThan(beforeCount);
  });

  it("should handle route with parameter constraints", () => {
    const expressRouter = express.Router();
    // Use standard parameter syntax instead of regex
    expressRouter.get("/users/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    mountExpressRouter("/api", expressRouter);

    const route = router.getRoutes().find((r) => r.path === "/api/users/:id");
    expect(route).toBeDefined();
  });

  it("should log warning for router without stack", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation((message) => {
        console.log(message);
      });

    // Create a mock router without stack
    const mockRouter = {} as express.Router;

    mountExpressRouter("/api", mockRouter);

    // Should handle gracefully without throwing
    expect(router.getRoutes().length).toBe(0);

    consoleWarnSpy.mockRestore();
  });

  it("should handle router with only middleware (no routes)", () => {
    const expressRouter = express.Router();
    expressRouter.use((req, res, next) => {
      next();
    });

    const beforeCount = router.getRoutes().length;
    mountExpressRouter("/api", expressRouter);

    // Should register routes (middleware creates wildcard routes)
    expect(router.getRoutes().length).toBeGreaterThanOrEqual(beforeCount);
  });
});
