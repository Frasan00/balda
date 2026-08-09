import type { Auth } from "better-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

const ALL_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

/** Stub auth whose handler just echoes the matched path back, so routing can be asserted. */
const makeAuth = (basePath = "/api/auth"): Auth =>
  ({
    options: { basePath },
    handler: async (req: globalThis.Request) =>
      new globalThis.Response(
        JSON.stringify({ path: new URL(req.url).pathname }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  }) as unknown as Auth;

describe("mountBetterAuth", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("registers all 7 HTTP verbs at `${basePath}/*`", async () => {
    mountBetterAuth(makeAuth());

    const server = new Server();
    for (const method of ALL_METHODS) {
      const res = await server.inject(method as any, "/api/auth/session");
      expect(res.statusCode()).toBe(200);
    }
  });

  it("matches deeply nested paths under the base path", async () => {
    mountBetterAuth(makeAuth());
    const server = new Server();

    const res = await server.inject.get(
      "/api/auth/callback/github/extra/nested",
    );

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      path: "/api/auth/callback/github/extra/nested",
    });
  });

  it("resolves basePath: explicit option wins over auth.options.basePath", async () => {
    mountBetterAuth(makeAuth("/from-auth-options"), {
      basePath: "/explicit",
    });
    const server = new Server();

    const res = await server.inject.get("/explicit/session");
    expect(res.statusCode()).toBe(200);

    const notMounted = await server.inject.get("/from-auth-options/session");
    expect(notMounted.statusCode()).toBe(404);
  });

  it("resolves basePath: auth.options.basePath wins over the /api/auth default", async () => {
    mountBetterAuth(makeAuth("/from-auth-options"));
    const server = new Server();

    const res = await server.inject.get("/from-auth-options/session");
    expect(res.statusCode()).toBe(200);
  });

  it("defaults to /api/auth when neither is set", async () => {
    const auth = {
      options: {},
      handler: makeAuth().handler,
    } as unknown as Auth;
    mountBetterAuth(auth);
    const server = new Server();

    const res = await server.inject.get("/api/auth/session");
    expect(res.statusCode()).toBe(200);
  });

  it("marks every registered route excludeFromSwagger", () => {
    mountBetterAuth(makeAuth());

    const authRoutes = router
      .getRoutes()
      .filter((r) => r.path === "/api/auth/*");

    expect(authRoutes).toHaveLength(ALL_METHODS.length);
    for (const route of authRoutes) {
      expect(route.swaggerOptions?.excludeFromSwagger).toBe(true);
    }
  });

  it("does not shadow routes registered before or after it", async () => {
    const server = new Server();
    server.router.get("/before", (_req, res) => res.send("before"));

    mountBetterAuth(makeAuth());

    server.router.get("/after", (_req, res) => res.send("after"));

    const before = await server.inject.get("/before");
    const after = await server.inject.get("/after");
    const auth = await server.inject.get("/api/auth/session");

    expect(before.body()).toBe("before");
    expect(after.body()).toBe("after");
    expect(auth.statusCode()).toBe(200);
  });
});
