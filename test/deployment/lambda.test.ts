import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handle } from "../../src/index.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";
import type {
  LambdaProxyEventV2,
  LambdaProxyResultV2,
} from "../../src/runtime/native_server/server_lambda.js";

/**
 * Fixture-driven coverage for the AWS Lambda adapter (`handle()`), which bridges an API
 * Gateway HTTP API v2 / Lambda Function URL event to `server.fetch()`. No Docker/AWS emulator
 * involved - this is where the event<->Request/Response bridge itself would break.
 */

/** `method` is a shorthand for the one `requestContext.http` field these tests ever vary. */
function makeEvent(
  overrides: Partial<Omit<LambdaProxyEventV2, "requestContext">> & {
    method?: string;
  } = {},
): LambdaProxyEventV2 {
  const { method = "GET", ...rest } = overrides;
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/",
    rawQueryString: "",
    headers: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: "000000000000",
      apiId: "abc123",
      domainName: "abc123.lambda-url.us-east-1.on.aws",
      domainPrefix: "abc123",
      http: {
        method,
        path: "/",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "test-request-id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    ...rest,
  };
}

/** `result.body`/`result.headers` are optional per the real API Gateway v2 type - `handle()`
 * always fills them in, so these helpers just remove the null-check noise from assertions. */
function bodyJson(result: LambdaProxyResultV2): unknown {
  return JSON.parse(result.body ?? "");
}
function header(result: LambdaProxyResultV2, name: string): unknown {
  return result.headers?.[name];
}

describe("AWS Lambda adapter", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  it("routes a plain GET request and returns a text/JSON result unencoded", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/health", (_req, res) => res.ok({ status: "ok" }));

    const result = await handle(server)(makeEvent({ rawPath: "/health" }));

    expect(result.statusCode).toBe(200);
    expect(result.isBase64Encoded).toBe(false);
    expect(bodyJson(result)).toEqual({ status: "ok" });
    expect(header(result, "content-type")).toContain("application/json");
  });

  it("resolves the raw query string", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/search", (req, res) => res.ok({ q: req.query.q }));

    const result = await handle(server)(
      makeEvent({ rawPath: "/search", rawQueryString: "q=balda" }),
    );

    expect(bodyJson(result)).toEqual({ q: "balda" });
  });

  it("resolves path params", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/users/:id", (req, res) =>
      res.ok({ id: req.params.id }),
    );

    const result = await handle(server)(makeEvent({ rawPath: "/users/42" }));

    expect(bodyJson(result)).toEqual({ id: "42" });
  });

  it("merges event.cookies into a single Cookie header", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/cookies", (req, res) =>
      res.ok({ cookie: req.rawHeaders.get("cookie") }),
    );

    const result = await handle(server)(
      makeEvent({
        rawPath: "/cookies",
        cookies: ["a=1", "b=2"],
      }),
    );

    expect(bodyJson(result)).toEqual({ cookie: "a=1; b=2" });
  });

  it("decodes a base64-encoded request body and parses JSON", async () => {
    const server = new Server({
      swagger: false,
      plugins: { bodyParser: { json: {} } },
    });
    server.router.post("/echo", (req, res) => res.ok(req.body as any));

    const payload = JSON.stringify({ hello: "world" });
    const result = await handle(server)(
      makeEvent({
        rawPath: "/echo",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: Buffer.from(payload).toString("base64"),
        isBase64Encoded: true,
      }),
    );

    expect(bodyJson(result)).toEqual({ hello: "world" });
  });

  it("passes a plain (non-base64) request body through", async () => {
    const server = new Server({
      swagger: false,
      plugins: { bodyParser: { json: {} } },
    });
    server.router.post("/echo", (req, res) => res.ok(req.body as any));

    const result = await handle(server)(
      makeEvent({
        rawPath: "/echo",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plain: true }),
        isBase64Encoded: false,
      }),
    );

    expect(bodyJson(result)).toEqual({ plain: true });
  });

  it("puts Set-Cookie response headers into result.cookies, not headers", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/set-cookie", (_req, res) => {
      res.setHeader("Set-Cookie", "session=abc; Path=/");
      res.ok({ ok: true });
    });

    const result = await handle(server)(makeEvent({ rawPath: "/set-cookie" }));

    expect(result.cookies).toEqual(["session=abc; Path=/"]);
    expect(header(result, "set-cookie")).toBeUndefined();
  });

  it("base64-encodes a binary response body", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/binary", (_req, res) => {
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(new Uint8Array([1, 2, 3, 4]) as any);
    });

    const result = await handle(server)(makeEvent({ rawPath: "/binary" }));

    expect(result.isBase64Encoded).toBe(true);
    expect(Buffer.from(result.body ?? "", "base64")).toEqual(
      Buffer.from([1, 2, 3, 4]),
    );
  });

  it("base64-encodes a response body carrying Content-Encoding", async () => {
    const server = new Server({ swagger: false });
    server.router.get("/compressed", (_req, res) => {
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Encoding", "gzip");
      res.send("still text, but declared compressed" as any);
    });

    const result = await handle(server)(makeEvent({ rawPath: "/compressed" }));

    expect(result.isBase64Encoded).toBe(true);
  });

  it("returns 404 for an unmatched route", async () => {
    const server = new Server({ swagger: false });

    const result = await handle(server)(makeEvent({ rawPath: "/nope" }));

    expect(result.statusCode).toBe(404);
  });
});
