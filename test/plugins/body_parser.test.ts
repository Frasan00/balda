import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

/**
 * Reproduces the "POST with Content-Type: application/json and no body"
 * scenario that used to throw "Invalid JSON syntax" because the JSON body
 * parser ran JSON.parse("") on an empty body.
 *
 * The mock server always sets content-type: application/json, even when no
 * `body` option is supplied, so `inject.post("/x")` with no options is the
 * exact reproducer for an apiJson-style client sending an empty POST.
 */
describe("bodyParser JSON - empty body handling", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const makeServer = (jsonOptions: Record<string, unknown> = {}) =>
    new Server({
      plugins: { bodyParser: { json: jsonOptions } },
    });

  it("treats an empty-body JSON POST as {} by default (no 400)", async () => {
    const server = makeServer();

    server.router.post("/echo", (req, res) => {
      res.json({ body: req.body });
    });

    // No `body` option -> empty body, content-type: application/json.
    const res = await server.inject.post("/echo");

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ body: {} });
  });

  it("treats a whitespace-only body as empty", async () => {
    const server = makeServer();

    server.router.post("/echo", (req, res) => {
      res.json({ body: req.body });
    });

    const res = await server.inject.post("/echo", { body: "   " });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ body: {} });
  });

  it("leaves req.body undefined when parseEmptyBodyAsObject is false", async () => {
    const server = makeServer({ parseEmptyBodyAsObject: false });

    server.router.post("/echo", (req, res) => {
      res.json({ isUndefined: req.body === undefined });
    });

    const res = await server.inject.post("/echo");

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ isUndefined: true });
  });

  it("still parses a real JSON body", async () => {
    const server = makeServer();

    server.router.post("/echo", (req, res) => {
      res.json({ body: req.body });
    });

    const res = await server.inject.post("/echo", { body: { name: "balda" } });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ body: { name: "balda" } });
  });

  it("still rejects non-empty invalid JSON with 400 Invalid JSON syntax", async () => {
    const server = makeServer();

    server.router.post("/echo", (req, res) => {
      res.json({ body: req.body });
    });

    const res = await server.inject.post("/echo", { body: "{not json" });

    expect(res.statusCode()).toBe(400);
  });
});
