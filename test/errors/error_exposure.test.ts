import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveExposeErrorDetails,
  setExposeErrorDetails,
} from "../../src/errors/error_factory.js";
import { RouteNotFoundError } from "../../src/errors/route_not_found.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

let server: Server<"http"> | undefined;
let originalNodeEnv: string | undefined;

beforeEach(() => {
  router.clearRoutes();
  originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
});

afterEach(async () => {
  if (server?.isListening) {
    await server.close({ timeoutMs: 0 });
  }
  server = undefined;
  router.clearRoutes();
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  setExposeErrorDetails(false);
});

const makeServer = (options: ConstructorParameters<typeof Server>[0] = {}) =>
  new Server({
    swagger: false,
    plugins: { bodyParser: { json: {} } },
    ...options,
  });

const postMalformedJson = (s: Server) =>
  s.inject.post("/echo", { body: "{not json" });

describe("error detail exposure", () => {
  it("resolves the option purely", () => {
    expect(resolveExposeErrorDetails(undefined, "development")).toBe(false);
    expect(resolveExposeErrorDetails(false, "development")).toBe(false);
    expect(resolveExposeErrorDetails(true, "production")).toBe(true);
    expect(resolveExposeErrorDetails("auto", "development")).toBe(true);
    expect(resolveExposeErrorDetails("auto", "production")).toBe(false);
  });

  it("does not leak a stack trace when NODE_ENV=development", async () => {
    server = makeServer();
    server.router.post("/echo", (_req, res) => res.json({ ok: true }));

    const res = await postMalformedJson(server);

    expect(res.statusCode()).toBe(400);
    expect(res.body()).not.toHaveProperty("stack");
    expect(res.body()).not.toHaveProperty("cause");
  });

  it("does not leak a stack trace on the 404 path when NODE_ENV=development", async () => {
    server = makeServer();

    const res = await server.fetch(new Request("http://localhost/missing"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(404);
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("cause");
  });

  it("includes stack when exposeErrorDetails is true", async () => {
    server = makeServer({ exposeErrorDetails: true });
    server.router.post("/echo", (_req, res) => res.json({ ok: true }));

    const res = await postMalformedJson(server);

    expect(res.statusCode()).toBe(400);
    expect(typeof (res.body() as any).stack).toBe("string");
  });

  it("exposes details under development when exposeErrorDetails is 'auto'", async () => {
    server = makeServer({ exposeErrorDetails: "auto" });
    server.router.post("/echo", (_req, res) => res.json({ ok: true }));

    const res = await postMalformedJson(server);

    expect(typeof (res.body() as any).stack).toBe("string");
  });
});

describe("not found handler context", () => {
  it("receives the underlying error (with stack) as context", async () => {
    server = makeServer();
    let received: unknown;

    server.setNotFoundHandler((_req, res, error) => {
      received = error;
      res.status(404).json({ code: (error as Error).message });
    });

    const res = await server.fetch(new Request("http://localhost/missing"));

    expect(res.status).toBe(404);
    expect(received).toBeInstanceOf(RouteNotFoundError);
    expect((received as Error).stack).toBeTruthy();
  });
});
