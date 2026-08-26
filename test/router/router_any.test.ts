import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "../../src/server/router/router.js";
import { router as singletonRouter } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";
import { canHaveBody } from "../../src/runtime/native_server/server_utils.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

const ALL_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

describe("Router - any()", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("matches every known HTTP method", () => {
    const handler = (req: Request, res: Response) => {};
    router.any("/x", handler);

    for (const method of ALL_METHODS) {
      const match = router.find(method, "/x");
      expect(match).not.toBeNull();
      expect(match!.handler).toBe(handler);
    }
  });

  it("matches unknown/future HTTP methods (e.g. QUERY) without router.query()", () => {
    const handler = (req: Request, res: Response) => {};
    router.any("/x", handler);

    const match = router.find("QUERY", "/x");
    expect(match).not.toBeNull();
    expect(match!.handler).toBe(handler);
  });

  it("a specific method route shadows any() for that method", () => {
    const anyHandler = (req: Request, res: Response) => {};
    const postHandler = (req: Request, res: Response) => {};
    router.any("/x", anyHandler);
    router.post("/x", postHandler);

    expect(router.find("POST", "/x")!.handler).toBe(postHandler);
    expect(router.find("GET", "/x")!.handler).toBe(anyHandler);
  });

  it("supports options (middlewares and body validation)", () => {
    const seen: string[] = [];
    const mw = (req: Request, res: Response, next: () => void) => {
      seen.push("mw");
      return next();
    };
    router.any(
      "/x",
      { middlewares: [mw], body: { type: "object", properties: {} } },
      (req, res) => {
        seen.push("handler");
      },
    );

    const match = router.find("POST", "/x");
    expect(match).not.toBeNull();
    expect(match!.middleware).toContain(mw);
  });

  it("works inside a group", () => {
    const handler = (req: Request, res: Response) => {};
    router.group("/api", (child) => {
      child.any("/x", handler);
    });

    expect(router.find("GET", "/api/x")!.handler).toBe(handler);
    expect(router.find("QUERY", "/api/x")!.handler).toBe(handler);
  });

  it("throws for duplicate any() routes on the same path", () => {
    const handler = (req: Request, res: Response) => {};
    router.any("/x", handler);
    expect(() => router.any("/x", handler)).toThrow("Duplicate route detected");
  });

  it("a root catch-all any() is not clobbered by the server not-found fallback", async () => {
    const server = new Server();
    const catchAll = (req: Request, res: Response) =>
      res.json({ caught: req.method });
    server.router.any("*", catchAll);

    const res = await server.inject("GET", "/anything");
    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ caught: "GET" });
  });
});

describe("Router - query()", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  afterEach(() => {
    router.clearRoutes();
    singletonRouter.clearRoutes();
  });

  it("registers and resolves the QUERY method", () => {
    const handler = (req: Request, res: Response) => {};
    router.query("/x", handler);

    expect(router.find("QUERY", "/x")!.handler).toBe(handler);
    expect(router.find("GET", "/x")).toBeNull();
  });

  it("QUERY can carry a body", () => {
    expect(canHaveBody("QUERY")).toBe(true);
  });

  it("serves a QUERY request end to end", async () => {
    const server = new Server({ plugins: { bodyParser: { json: {} } } });
    server.router.query("/search", (req, res) =>
      res.json({ body: req.body, query: req.query }),
    );

    const res = await server.inject("QUERY", "/search", {
      body: { q: "balda" },
      query: { limit: "10" },
    });
    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      body: { q: "balda" },
      query: { limit: "10" },
    });
  });
});

describe("Server - not-found fallback via any-tree", () => {
  afterEach(() => {
    singletonRouter.clearRoutes();
  });

  it("returns 405 with Allow when only another method is registered", async () => {
    const server = new Server();
    server.router.post("/x", (req, res) => res.json({ ok: true }));

    const res = await server.inject.get("/x");
    expect(res.statusCode()).toBe(405);
    expect(res.headers()["Allow"]).toContain("POST");
  });

  it("returns 404 for an unknown method on a path with no routes", async () => {
    const server = new Server();
    const res = await server.inject("QUERY", "/nope");
    expect(res.statusCode()).toBe(404);
  });

  it("routes unknown methods through the custom notFound handler", async () => {
    const server = new Server();
    server.setNotFoundHandler((req, res) =>
      res.status(418).json({ custom: true }),
    );

    const res = await server.inject("QUERY", "/nope");
    expect(res.statusCode()).toBe(418);
    expect(res.body()).toEqual({ custom: true });
  });
});
