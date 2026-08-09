import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

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
});
