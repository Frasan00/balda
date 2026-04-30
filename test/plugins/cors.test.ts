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
    expect(response.headers()["Access-Control-Allow-Headers"]).toBe(
      "Content-Type,Authorization",
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
    expect(response.headers()["Access-Control-Allow-Headers"]).toBe(
      "X-Test-Header",
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
});
