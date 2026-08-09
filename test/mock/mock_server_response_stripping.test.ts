import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";
import { Request, Response, ServerRouteMiddleware } from "../../src/index.js";

/**
 * Regression test: `MockServer.request()` (used by `server.inject`) built a
 * bare `Response` and never called `setRouteResponseSchemas`, so routes with
 * a `responses` schema never stripped undeclared properties through inject
 * even though the real Node/Bun/Deno runtimes already did.
 */
describe("MockServer - response schema stripping", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("strips non-schema properties through server.inject", async () => {
    const server = new Server();
    server.router.get(
      "/probe",
      { responses: { 200: z.object({ a: z.string() }) } },
      async (_req, res) => {
        res.ok({
          a: "visible",
          b: "should-be-stripped",
          c: { nested: "also-hidden" },
        });
      },
    );

    const res = await server.inject.get("/probe");

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ a: "visible" });
  });

  /**
   * Regression test: `applyGlobalMiddlewaresToAllRoutes` (run once at bootstrap
   * whenever `server.use()` registered anything) re-registered every route
   * without forwarding its `responses` schema, silently overwriting the
   * static-route cache entry and dropping response stripping. Dynamic routes
   * happened to survive since their schema map is keyed separately - this
   * test locks in the static-route case, which leaked over real HTTP too.
   */
  it("strips a static route's response even after a global middleware is registered", async () => {
    const noopMiddleware = async (
      _req: Request,
      _res: Response,
      next: () => Promise<void>,
    ) => next();

    const server = new Server();
    server.use(noopMiddleware as ServerRouteMiddleware);
    server.router.get(
      "/static-probe",
      { responses: { 200: z.object({ a: z.string() }) } },
      async (_req, res) => {
        res.ok({ a: "visible", b: "should-be-stripped" });
      },
    );

    const res = await server.inject.get("/static-probe");

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ a: "visible" });
  });
});
