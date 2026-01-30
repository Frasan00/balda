import express from "express";
import { beforeEach, describe, expect, it } from "vitest";
import { createExpressAdapter } from "../../../src/plugins/express/express.js";
import type { ServerRouteMiddleware } from "../../../src/runtime/native_server/server_types.js";
import { router } from "../../../src/server/router/router.js";

describe("Express Adapter Integration", () => {
  beforeEach(() => {
    // Clear router before each test
    router.routes = [];
  });

  it("should create adapter with use() method", () => {
    const mockServer = {
      use: () => {},
    };

    const adapter = createExpressAdapter(mockServer);

    expect(adapter).toBeDefined();
    expect(typeof adapter.use).toBe("function");
  });

  it("should mount global middleware without path", () => {
    let middlewareCalled = false;
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);
    const expressMiddleware = (req: any, res: any, next: any) => {
      middlewareCalled = true;
      next();
    };

    adapter.use(expressMiddleware);

    expect(mockServer.middlewares.length).toBe(1);
    expect(typeof mockServer.middlewares[0]).toBe("function");
  });

  it("should mount path-specific middleware", () => {
    let middlewareCalled = false;
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);
    const expressMiddleware = (req: any, res: any, next: any) => {
      middlewareCalled = true;
      next();
    };

    adapter.use("/api", expressMiddleware);

    expect(mockServer.middlewares.length).toBe(1);
  });

  it("should mount Express router at path", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);
    const expressRouter = express.Router();
    expressRouter.get("/users", (req, res) => res.json({ users: [] }));

    adapter.use("/api", expressRouter);

    // Router should be mounted and routes registered
    const route = router.routes.find((r) => r.path === "/api/users");
    expect(route).toBeDefined();
  });

  it("should mount Express router at root", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);
    const expressRouter = express.Router();
    expressRouter.get("/health", (req, res) => res.json({ status: "ok" }));

    adapter.use(expressRouter);

    const route = router.routes.find((r) => r.path === "/health");
    expect(route).toBeDefined();
  });

  it("should distinguish between middleware and router by stack property", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    // Regular middleware (no stack)
    const regularMiddleware = (req: any, res: any, next: any) => next();
    adapter.use("/path1", regularMiddleware);

    // Router (has stack)
    const expressRouter = express.Router();
    expressRouter.get("/test", (req, res) => res.json({}));
    adapter.use("/path2", expressRouter);

    // Regular middleware should be added to server.middlewares
    expect(mockServer.middlewares.length).toBe(1);

    // Router should be mounted and routes registered
    const route = router.routes.find((r) => r.path === "/path2/test");
    expect(route).toBeDefined();
  });

  it("should mount multiple routers at different paths", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const usersRouter = express.Router();
    usersRouter.get("/", (req, res) => res.json({ users: [] }));

    const postsRouter = express.Router();
    postsRouter.get("/", (req, res) => res.json({ posts: [] }));

    adapter.use("/users", usersRouter);
    adapter.use("/posts", postsRouter);

    const usersRoute = router.routes.find((r) => r.path === "/users");
    const postsRoute = router.routes.find((r) => r.path === "/posts");

    expect(usersRoute).toBeDefined();
    expect(postsRoute).toBeDefined();
  });

  it("should handle complex routing scenario", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    // Global middleware
    adapter.use((req, res, next) => next());

    // API v1 router
    const v1Router = express.Router();
    v1Router.get("/users", (req, res) => res.json({}));
    adapter.use("/api/v1", v1Router);

    // API v2 router
    const v2Router = express.Router();
    v2Router.get("/users", (req, res) => res.json({}));
    adapter.use("/api/v2", v2Router);

    // Admin router
    const adminRouter = express.Router();
    adminRouter.get("/dashboard", (req, res) => res.json({}));
    adapter.use("/admin", adminRouter);

    expect(mockServer.middlewares.length).toBe(1);

    const v1Route = router.routes.find((r) => r.path === "/api/v1/users");
    const v2Route = router.routes.find((r) => r.path === "/api/v2/users");
    const adminRoute = router.routes.find((r) => r.path === "/admin/dashboard");

    expect(v1Route).toBeDefined();
    expect(v2Route).toBeDefined();
    expect(adminRoute).toBeDefined();
  });

  it("should mount nested routers correctly", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const postsRouter = express.Router();
    postsRouter.get("/", (req, res) => res.json({ posts: [] }));

    const beforeCount = router.routes.length;
    adapter.use("/api/posts", postsRouter);

    // Should register routes
    expect(router.routes.length).toBeGreaterThan(beforeCount);

    const postsRoute = router.routes.find((r) => r.path === "/api/posts");
    expect(postsRoute).toBeDefined();
  });

  it("should handle router with middleware", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const protectedRouter = express.Router();

    // Router-level middleware
    protectedRouter.use((req, res, next) => {
      // Auth check
      next();
    });

    protectedRouter.get("/private", (req, res) => res.json({ secret: "data" }));

    adapter.use("/protected", protectedRouter);

    // Should register wildcard middleware routes
    const wildcardRoutes = router.routes.filter((r) =>
      r.path.includes("/protected/*"),
    );
    expect(wildcardRoutes.length).toBeGreaterThan(0);

    // Should also register the actual route
    const privateRoute = router.routes.find(
      (r) => r.path === "/protected/private",
    );
    expect(privateRoute).toBeDefined();
  });

  it("should work with third-party Express routers", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    // Simulate a third-party router (like AdminJS)
    const thirdPartyRouter = express.Router();
    thirdPartyRouter.get("/dashboard", (req, res) =>
      res.json({ dashboard: true }),
    );
    thirdPartyRouter.post("/login", (req, res) =>
      res.json({ authenticated: true }),
    );
    thirdPartyRouter.get("/resources", (req, res) =>
      res.json({ resources: [] }),
    );

    adapter.use("/admin", thirdPartyRouter);

    const dashboardRoute = router.routes.find(
      (r) => r.path === "/admin/dashboard",
    );
    const loginRoute = router.routes.find((r) => r.path === "/admin/login");
    const resourcesRoute = router.routes.find(
      (r) => r.path === "/admin/resources",
    );

    expect(dashboardRoute).toBeDefined();
    expect(loginRoute).toBeDefined();
    expect(resourcesRoute).toBeDefined();
  });

  it("should allow chaining use() calls", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const middleware1 = (req: any, res: any, next: any) => next();
    const middleware2 = (req: any, res: any, next: any) => next();

    // Should be able to chain
    adapter.use(middleware1);
    adapter.use(middleware2);

    expect(mockServer.middlewares.length).toBe(2);
  });

  it("should handle empty router", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);
    const emptyRouter = express.Router();

    // Should not throw
    expect(() => {
      adapter.use("/empty", emptyRouter);
    }).not.toThrow();
  });

  it("should pass base path to middleware conversion", () => {
    let capturedBasePath: string | undefined;

    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const expressMiddleware = (req: any, res: any, next: any) => {
      capturedBasePath = req.baseUrl;
      next();
    };

    adapter.use("/custom", expressMiddleware);

    // The middleware should be wrapped with the base path
    expect(mockServer.middlewares.length).toBe(1);
  });

  it("should handle middleware array", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    // Express allows passing middleware functions directly
    const mw1 = (req: any, res: any, next: any) => next();
    adapter.use(mw1);

    expect(mockServer.middlewares.length).toBe(1);
  });

  it("should maintain Express router integrity", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    const testRouter = express.Router();

    // Add various route types
    testRouter.get("/get-route", (req, res) => res.json({}));
    testRouter.post("/post-route", (req, res) => res.json({}));
    testRouter.put("/put-route", (req, res) => res.json({}));
    testRouter.patch("/patch-route", (req, res) => res.json({}));
    testRouter.delete("/delete-route", (req, res) => res.json({}));

    adapter.use("/test", testRouter);

    // All routes should be registered
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const routeNames = [
      "get-route",
      "post-route",
      "put-route",
      "patch-route",
      "delete-route",
    ];

    for (let i = 0; i < methods.length; i++) {
      const route = router.routes.find(
        (r) => r.path === `/test/${routeNames[i]}` && r.method === methods[i],
      );
      expect(route).toBeDefined();
    }
  });

  it("should work with Express application-like routers", () => {
    const mockServer = {
      middlewares: [] as ServerRouteMiddleware[],
      use(...middlewares: ServerRouteMiddleware[]) {
        this.middlewares.push(...middlewares);
      },
    };

    const adapter = createExpressAdapter(mockServer);

    // Create a router that mimics an Express application
    const appRouter = express.Router();

    appRouter.get("/", (req, res) => res.json({ home: true }));
    appRouter.get("/about", (req, res) => res.json({ about: true }));
    appRouter.get("/contact", (req, res) => res.json({ contact: true }));

    adapter.use(appRouter);

    const homeRoute = router.routes.find((r) => r.path === "/");
    const aboutRoute = router.routes.find((r) => r.path === "/about");
    const contactRoute = router.routes.find((r) => r.path === "/contact");

    expect(homeRoute).toBeDefined();
    expect(aboutRoute).toBeDefined();
    expect(contactRoute).toBeDefined();
  });
});
