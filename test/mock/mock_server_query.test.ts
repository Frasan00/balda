import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

/**
 * Regression test for a bug found while testing the better-auth adapter:
 * `MockServer.request()` (used by `server.inject`) unconditionally set
 * `url.search` from the `query` option, wiping out any query string
 * embedded directly in the `path` argument whenever `query` wasn't passed.
 */
describe("MockServer - query string handling", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("preserves a query string embedded directly in the path", async () => {
    const server = new Server();
    server.router.get("/echo", (req, res) => res.json({ query: req.query }));

    const res = await server.inject.get("/echo?token=abc&state=xyz");

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ query: { token: "abc", state: "xyz" } });
  });

  it("still applies the explicit query option when no query is embedded", async () => {
    const server = new Server();
    server.router.get("/echo", (req, res) => res.json({ query: req.query }));

    const res = await server.inject.get("/echo", { query: { a: "1" } });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ query: { a: "1" } });
  });

  it("the explicit query option overrides an embedded query string", async () => {
    const server = new Server();
    server.router.get("/echo", (req, res) => res.json({ query: req.query }));

    const res = await server.inject.get("/echo?token=stale", {
      query: { token: "fresh" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ query: { token: "fresh" } });
  });
});
