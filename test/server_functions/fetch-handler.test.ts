import { afterEach, describe, expect, it } from "vitest";
import { Server } from "../../src/index.js";
import { router } from "../../src/server/router/router.js";

/**
 * Coverage for `server.fetch()` - the Web-standard `fetch(request) => Promise<response>`
 * handler shared by Bun, Deno, and any platform that hands balda a Web `Request` outside of
 * `listen()` (Vercel/Netlify functions, Deno Deploy, a Service Worker, ...). It runs the same
 * `createFetchHandler` pipeline `server_bun.ts`/`server_deno.ts` use, so this doubles as
 * regression coverage for that refactor.
 */

let server: Server<"http"> | undefined;

afterEach(async () => {
  if (server?.isListening) {
    await server.close({ timeoutMs: 0 });
  }
  server = undefined;
  router.clearRoutes();
});

function makeServer(): Server {
  return new Server({
    swagger: false,
    plugins: { bodyParser: { json: {} } },
  });
}

describe("server.fetch()", () => {
  it("routes a plain GET request", async () => {
    router.get("/health", async (_req, res) => {
      res.ok({ status: "ok" });
    });
    server = makeServer();

    const res = await server.fetch(new Request("http://localhost/health"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("resolves path params", async () => {
    router.get("/users/:id", async (req, res) => {
      res.ok({ id: req.params.id });
    });
    server = makeServer();

    const res = await server.fetch(new Request("http://localhost/users/42"));

    expect(await res.json()).toEqual({ id: "42" });
  });

  it("resolves the query string", async () => {
    router.get("/search", async (req, res) => {
      res.ok({ q: req.query.q });
    });
    server = makeServer();

    const res = await server.fetch(
      new Request("http://localhost/search?q=balda"),
    );

    expect(await res.json()).toEqual({ q: "balda" });
  });

  it("parses a JSON POST body", async () => {
    router.post("/echo", { middlewares: [] }, async (req, res) => {
      res.ok(req.body as any);
    });
    server = makeServer();

    const res = await server.fetch(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      }),
    );

    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("runs middleware before the handler, in order", async () => {
    const order: string[] = [];
    router.get(
      "/mw",
      {
        middlewares: [
          async (_req, _res, next) => {
            order.push("first");
            await next();
          },
          async (_req, _res, next) => {
            order.push("second");
            await next();
          },
        ],
      },
      async (_req, res) => {
        order.push("handler");
        res.ok({ order });
      },
    );
    server = makeServer();

    const res = await server.fetch(new Request("http://localhost/mw"));

    expect(await res.json()).toEqual({
      order: ["first", "second", "handler"],
    });
  });

  it("returns 404 for an unmatched route", async () => {
    server = makeServer();

    const res = await server.fetch(new Request("http://localhost/nope"));

    expect(res.status).toBe(404);
  });

  it("runs a registered error handler when a handler throws", async () => {
    router.get("/boom", async () => {
      throw new Error("kaboom");
    });
    server = makeServer();
    server.setErrorHandler(async (_req, res, _next, error) => {
      res.internalServerError({ message: error.message } as any);
    });

    const res = await server.fetch(new Request("http://localhost/boom"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "kaboom" });
  });

  it("matches server.inject() for the same route", async () => {
    router.get("/parity", async (req, res) => {
      res.ok({ q: req.query.q ?? null });
    });
    server = makeServer();

    const fetchRes = await server.fetch(
      new Request("http://localhost/parity?q=1"),
    );
    const injectRes = await server.inject.get<{ q: string }>("/parity", {
      query: { q: "1" },
    });

    expect(await fetchRes.json()).toEqual(injectRes.body());
    expect(fetchRes.status).toBe(injectRes.statusCode());
  });
});
