import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cors } from "../../src/plugins/cors/cors.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

describe("CORS Plugin", () => {
  const allowedOrigin = "https://app.example.com";

  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("keeps default headers when only origin is configured at route level", async () => {
    const server = new Server();

    server.router.options(
      "/route-level-cors",
      {
        middlewares: [cors({ origin: [allowedOrigin] })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/route-level-cors", {
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "Content-Type,Authorization",
      },
    });

    expect(response.statusCode()).toBe(204);
    expect(response.headers()["Access-Control-Allow-Origin"]).toBe(
      allowedOrigin,
    );
    expect(response.headers()["Access-Control-Allow-Methods"]).toBe(
      "GET,HEAD,PUT,PATCH,POST,DELETE",
    );
    // No header reflection: defaults to safe allowlist
    expect(response.headers()["Access-Control-Allow-Headers"]).toBe(
      "Content-Type,Accept,Authorization",
    );
  });

  it("keeps default headers when configured through server plugins", async () => {
    const server = new Server({
      plugins: {
        cors: {
          origin: [allowedOrigin],
        },
      },
    });

    server.router.options("/plugin-cors", async (_req, res) => {
      res.send("should not reach handler");
    });

    const response = await server.inject("OPTIONS", "/plugin-cors", {
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "GET",
        "access-control-request-headers": "X-Test-Header",
      },
    });

    expect(response.statusCode()).toBe(204);
    expect(response.headers()["Access-Control-Allow-Origin"]).toBe(
      allowedOrigin,
    );
    expect(response.headers()["Access-Control-Allow-Methods"]).toBe(
      "GET,HEAD,PUT,PATCH,POST,DELETE",
    );
    // No header reflection: defaults to safe allowlist regardless of request headers
    expect(response.headers()["Access-Control-Allow-Headers"]).toBe(
      "Content-Type,Accept,Authorization",
    );
  });

  it("lets allowedHeaders override the default reflected preflight headers", async () => {
    const server = new Server();

    server.router.options(
      "/allowed-headers-override",
      {
        middlewares: [
          cors({
            origin: [allowedOrigin],
            allowedHeaders: ["Content-Type", "Authorization"],
          }),
        ],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject(
      "OPTIONS",
      "/allowed-headers-override",
      {
        headers: {
          origin: allowedOrigin,
          "access-control-request-method": "PATCH",
          "access-control-request-headers": "X-Test-Header",
        },
      },
    );

    expect(response.headers()["Access-Control-Allow-Headers"]).toBe(
      "Content-Type,Authorization",
    );
  });

  it("reflects the request origin when a regex origin matches", async () => {
    const server = new Server();

    server.router.options(
      "/regex-origin",
      {
        middlewares: [
          cors({
            origin: [/^https:\/\/.*\.example\.com$/],
          }),
        ],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/regex-origin", {
      headers: {
        origin: "https://admin.example.com",
        "access-control-request-method": "GET",
      },
    });

    expect(response.headers()["Access-Control-Allow-Origin"]).toBe(
      "https://admin.example.com",
    );
  });

  it("returns 403 for preflight when origin is not allowlisted", async () => {
    const server = new Server();

    server.router.options(
      "/deny-origin",
      {
        middlewares: [cors({ origin: [allowedOrigin] })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/deny-origin", {
      headers: {
        origin: "https://evil.example.com",
        "access-control-request-method": "POST",
      },
    });

    expect(response.statusCode()).toBe(403);
    expect(response.headers()["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("returns 403 for string origin when request origin does not match", async () => {
    const server = new Server();

    server.router.options(
      "/string-origin",
      {
        middlewares: [cors({ origin: allowedOrigin })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/string-origin", {
      headers: {
        origin: "https://evil.example.com",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode()).toBe(403);
  });

  it("allows string origin only for an exact match", async () => {
    const server = new Server();

    server.router.options(
      "/string-origin-match",
      {
        middlewares: [cors({ origin: allowedOrigin })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/string-origin-match", {
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode()).toBe(204);
    expect(response.headers()["Access-Control-Allow-Origin"]).toBe(
      allowedOrigin,
    );
  });

  it("throws when credentials are combined with a wildcard origin", () => {
    expect(() =>
      cors({
        origin: "*",
        credentials: true,
      }),
    ).toThrow(/cannot be combined/i);
  });

  it("rejects null origin by default", async () => {
    const server = new Server();

    server.router.options(
      "/null-origin",
      {
        middlewares: [cors({ origin: [allowedOrigin] })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/null-origin", {
      headers: {
        origin: "null",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode()).toBe(403);
  });

  it("rejects origins containing unsafe characters", async () => {
    const server = new Server();

    server.router.options(
      "/unsafe-origin",
      {
        middlewares: [cors({ origin: [allowedOrigin] })],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/unsafe-origin", {
      headers: {
        origin: "https://evil.com@injected",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode()).toBe(403);
  });

  it("omits CORS headers on GET when origin is not allowlisted", async () => {
    const server = new Server({
      plugins: {
        cors: {
          origin: [allowedOrigin],
        },
      },
    });

    server.router.get("/no-cors", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await server.inject.get("/no-cors", {
      headers: {
        origin: "https://evil.example.com",
      },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.headers()["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("returns 403 for preflight with a disallowed method", async () => {
    const server = new Server();

    server.router.options(
      "/deny-method",
      {
        middlewares: [
          cors({
            origin: [allowedOrigin],
            methods: ["GET"],
          }),
        ],
      },
      async (_req, res) => {
        res.send("should not reach handler");
      },
    );

    const response = await server.inject("OPTIONS", "/deny-method", {
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "DELETE",
      },
    });

    expect(response.statusCode()).toBe(403);
  });
});
