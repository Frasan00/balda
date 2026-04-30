import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../src/logger/logger.js";
import {
  asyncLocalStorage,
  asyncStorage,
} from "../../src/plugins/async_local_storage/async_local_storage.js";
import { cookie } from "../../src/plugins/cookie/cookie.js";
import { helmet } from "../../src/plugins/helmet/helmet.js";
import { log } from "../../src/plugins/log/log.js";
import { timeout } from "../../src/plugins/timeout/timeout.js";
import { trustProxy } from "../../src/plugins/trust_proxy/trust_proxy.js";
import { Response } from "../../src/server/http/response.js";
import type { Request } from "../../src/server/http/request.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getCookieHeader = (response: {
  headers: () => Record<string, string>;
}): string => {
  const setCookie =
    response.headers()["Set-Cookie"] ?? response.headers()["set-cookie"];

  expect(setCookie).toBeDefined();
  return String(setCookie).split(", ")[0].split(";")[0];
};

describe("Built-in plugin behavior", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
    asyncStorage.disable();
    vi.restoreAllMocks();
  });

  it("round-trips signed cookies through the Cookie header", async () => {
    const server = new Server({
      plugins: {
        cookie: {
          sign: true,
          secret: "super-secret",
        },
      },
    });

    server.router.get("/set-cookie", (_req, res) => {
      res.cookie?.("session", "abc123");
      res.json({ ok: true });
    });

    server.router.get("/read-cookie", (req, res) => {
      res.json({ session: req.cookie("session") });
    });

    const setCookieResponse = await server.inject.get("/set-cookie");
    const cookieHeader = getCookieHeader(setCookieResponse);

    expect(cookieHeader).toMatch(/^session=.+\..+$/);

    const readCookieResponse = await server.inject.get("/read-cookie", {
      headers: {
        cookie: cookieHeader,
      },
    });

    expect(readCookieResponse.body()).toEqual({ session: "abc123" });
  });

  it("requires a secret when cookie signing is enabled", () => {
    expect(() => cookie({ sign: true })).toThrow(
      "Cookie signing requires a secret",
    );
  });

  it("persists session state across requests when cookie middleware is enabled", async () => {
    const server = new Server({
      plugins: {
        cookie: {
          secret: "cookie-secret",
        },
        session: {},
      },
    });

    server.router.get("/session", (req, res) => {
      const session = req.session!;
      session.count = (session.count ?? 0) + 1;
      res.json({ count: session.count });
    });

    const firstResponse = await server.inject.get("/session");
    const cookieHeader = getCookieHeader(firstResponse);

    expect(firstResponse.body()).toEqual({ count: 1 });

    const secondResponse = await server.inject.get("/session", {
      headers: {
        cookie: cookieHeader,
      },
    });

    expect(secondResponse.body()).toEqual({ count: 2 });
  });

  it("awaits async local storage setters and preserves context across awaited work", async () => {
    const middleware = asyncLocalStorage({
      requestId: async (req) => {
        await sleep(0);
        return req.id;
      },
    });

    const req = { id: "req-1" } as Request;
    const res = new Response();
    let observedRequestId: string | undefined;
    let observedMutatedRequestId: string | undefined;

    await middleware(req, res, async () => {
      await sleep(0);
      const ctx = req.ctx as Record<string, unknown>;
      observedRequestId = ctx.requestId as string | undefined;
      ctx.requestId = "req-2";
      await sleep(0);
      observedMutatedRequestId = asyncStorage.getStore()?.requestId;
    });

    expect(observedRequestId).toBe("req-1");
    expect(observedMutatedRequestId).toBe("req-2");
  });

  it("marks raw request bodies as used after parsing the fallback array buffer", async () => {
    const server = new Server({
      plugins: {
        bodyParser: {},
      },
    });

    server.router.post("/raw-body", (req, res) => {
      res.json({
        bodyUsed: req.bodyUsed,
        byteLength: (req.body as ArrayBuffer).byteLength,
      });
    });

    const response = await server.inject.post("/raw-body", {
      body: new Uint8Array([1, 2, 3]),
      headers: {
        "content-type": "application/octet-stream",
      },
    });

    expect(response.body()).toEqual({
      bodyUsed: true,
      byteLength: 3,
    });
  });

  it("applies default helmet headers without setting a content security policy", async () => {
    const middleware = helmet();
    const res = new Response();

    await middleware({} as Request, res, async () => {});

    expect(res.headers["X-DNS-Prefetch-Control"]).toBe("off");
    expect(res.headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Referrer-Policy"]).toBe("no-referrer");
    expect(res.headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("respects trustProxy trust flag and hop selection", async () => {
    const lastHopRequest = {
      ip: "127.0.0.1",
      rawHeaders: new Headers([
        ["x-forwarded-for", "203.0.113.10, 198.51.100.5"],
      ]),
    } as unknown as Request;

    await trustProxy({
      trust: true,
      hop: "last",
    })(lastHopRequest, new Response(), async () => {});

    expect(lastHopRequest.ip).toBe("198.51.100.5");

    const untrustedRequest = {
      ip: "127.0.0.1",
      rawHeaders: new Headers([["x-forwarded-for", "203.0.113.10"]]),
    } as unknown as Request;

    await trustProxy({
      trust: false,
    })(untrustedRequest, new Response(), async () => {});

    expect(untrustedRequest.ip).toBe("127.0.0.1");
  });

  it("enforces rate limits for repeated requests from the same IP", async () => {
    const server = new Server({
      plugins: {
        rateLimiter: {
          keyOptions: {
            type: "ip",
            limit: 1,
          },
          storageOptions: {
            type: "memory",
            windowMs: 1_000,
          },
        },
      },
    });

    server.router.get("/limited", (_req, res) => {
      res.json({ ok: true });
    });

    const firstResponse = await server.inject.get("/limited", {
      ip: "203.0.113.10",
    });
    const secondResponse = await server.inject.get("/limited", {
      ip: "203.0.113.10",
    });

    expect(firstResponse.statusCode()).toBe(200);
    expect(secondResponse.statusCode()).toBe(429);
    expect(secondResponse.body()).toEqual({
      message: "ERR_RATE_LIMIT_EXCEEDED",
    });
  });

  it("serves static files from the configured public path", async () => {
    const server = new Server({
      plugins: {
        static: {
          source: "public",
          path: "/public",
        },
      },
    });

    const response = await server.inject.get("/public/test.html");

    expect(response.statusCode()).toBe(200);
    expect(response.headers()["Content-Type"]).toBe("text/html");
  });

  it("exposes the swagger JSON route by default", async () => {
    const server = new Server();

    server.router.get("/hello", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await server.inject.get("/docs/json");
    const body = response.body() as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(response.statusCode()).toBe(200);
    expect(body.openapi).toBe("3.0.0");
    expect(body.paths["/hello"]).toBeDefined();
  });

  it("does not expose swagger routes when swagger is disabled", async () => {
    const server = new Server({
      swagger: false,
    });

    const response = await server.inject.get("/docs/json");

    expect(response.statusCode()).toBe(404);
  });

  it("sets req.timeout once the middleware timer expires", async () => {
    const middleware = timeout({ ms: 5 });
    const req = {} as Request;
    let timedOutInsideHandler = false;

    await middleware(req, new Response(), async () => {
      await sleep(15);
      timedOutInsideHandler = req.timeout === true;
    });

    expect(timedOutInsideHandler).toBe(true);
    expect(req.timeout).toBe(true);
  });

  it("omits response status from log payload when that field is disabled", async () => {
    const info = vi.fn();
    const error = vi.fn();

    vi.spyOn(logger, "child").mockReturnValue({
      info,
      error,
    } as any);

    const middleware = log({
      responsePayload: {
        status: false,
      },
    });

    const req = {
      id: "req-1",
      method: "GET",
      url: "/logged",
      ip: "127.0.0.1",
      headers: {},
      body: undefined,
    } as unknown as Request;
    const res = new Response();

    await middleware(req, res, async () => {
      res.status(201).json({ ok: true });
    });

    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls[1][0]).toMatchObject({
      type: "response",
      requestId: "req-1",
      duration: expect.any(String),
    });
    expect(info.mock.calls[1][0].status).toBeUndefined();
  });
});
