import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { Server } from "../../src/index.js";
import { router } from "../../src/server/router/router.js";
import { runtime } from "../../src/runtime/runtime.js";

/**
 * Regression coverage for a real bug: Server.close() hung forever on Bun with a
 * WebSocket connection still fully open when close() was called - confirmed empirically
 * to be specifically about the connection still being open, not about how it eventually
 * gets closed: a client that closes gracefully, or is abruptly `.terminate()`d, before
 * close() is called was never actually broken (both already resolved promptly even on
 * the old code - see the "sanity check" cases below, kept as regression guards). Bun's
 * `stop()` waits on the underlying connection regardless of WS-level state once one is
 * open, and no userland workaround exists for it (confirmed: closing every tracked
 * client server-side first still doesn't unstick it).
 *
 * Node has the same underlying `http.Server.close()` limitation, but there it's fully
 * avoidable in userland today: the app's own `ws` library already tracks every client via
 * `wss.clients`, so closing them in a `beforeClose` hook fixes it with zero balda changes
 * (verified empirically too - see cases below). Node still gets a generic timeoutMs bound
 * as a backstop, but no WebSocket-specific tracking.
 *
 * These are real listening servers (not the mock server, which never binds a port - a
 * transport-level bug like this is unobservable through it), so this file is an
 * intentional exception to "always use the mock server for tests" - it's testing the
 * transport itself.
 */

const describeBun = runtime.type === "bun" ? describe : describe.skip;
const describeNode = runtime.type === "node" ? describe : describe.skip;

let server: Server<"http"> | undefined;

afterEach(async () => {
  if (server?.isListening) {
    await server.close({ timeoutMs: 0 });
  }
  server = undefined;
  router.clearRoutes();
});

/**
 * `waitUntilListening(0)` is what actually reaches the OS as "assign an ephemeral port" -
 * the bare `port` constructor option resolves `0` through `0 || 80`, silently becoming 80
 * (a separate, pre-existing bug, out of scope here). On Node, `listen()`'s callback also
 * fires before the underlying socket is actually bound (another pre-existing gap), so wait
 * for the real `net.Server` "listening" event too - the raw server object already exists
 * at construction time (`ServerNode` creates it eagerly), so it's safe to grab before
 * `waitUntilListening` resolves.
 */
async function listenEphemeral(s: Server): Promise<void> {
  if (runtime.type === "node") {
    const nodeServer = s.getNodeServer();
    const listening = once(nodeServer, "listening");
    await s.waitUntilListening(0);
    await listening;
    return;
  }
  await s.waitUntilListening(0);
}

describe("Server.close() - control (no WebSocket activity)", () => {
  it("resolves quickly and clears isListening", async () => {
    server = new Server({ host: "127.0.0.1", swagger: false });
    await listenEphemeral(server);

    const start = Date.now();
    await server.close();
    expect(Date.now() - start).toBeLessThan(1000);
    expect(server.isListening).toBe(false);
  });
});

describeBun("Server.close() - Bun WebSocket (the reported bug)", () => {
  it("resolves within timeoutMs instead of hanging when a client stays connected", async () => {
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          websocket: {
            open(ws) {
              ws.send("hello");
            },
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/`);
    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });
    await new Promise((r) => setTimeout(r, 100));

    const start = Date.now();
    await server.close({ timeoutMs: 500 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(1500);
    expect(server.isListening).toBe(false);
  }, 10_000);

  it("still resolves after a graceful client-side close() (sanity check - not the reported bug, must stay working)", async () => {
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          websocket: {
            open() {},
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/`);
    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });
    await new Promise((r) => setTimeout(r, 100));
    client.close();
    await new Promise((r) => setTimeout(r, 50));

    const start = Date.now();
    await server.close({ timeoutMs: 500 });
    expect(Date.now() - start).toBeLessThan(1500);
    expect(server.isListening).toBe(false);
  }, 10_000);

  it("still resolves after the client is .terminate()d first (sanity check - `ws` client, abrupt close; also not what actually reproduces the hang, only a fully-untouched connection does - see the case above)", async () => {
    const { WebSocket: NodeWebSocket } = await import("ws");
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          websocket: {
            open() {},
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const client = new NodeWebSocket(`ws://127.0.0.1:${port}/`);
    await once(client, "open");
    await new Promise((r) => setTimeout(r, 100));
    client.terminate();
    await new Promise((r) => setTimeout(r, 50));

    const start = Date.now();
    await server.close({ timeoutMs: 500 });
    expect(Date.now() - start).toBeLessThan(1500);
    expect(server.isListening).toBe(false);
  }, 10_000);
});

describeNode(
  "Server.close() - Node WebSocket (avoidable via wss.clients)",
  () => {
    it("still resolves within timeoutMs even without any app-level cleanup (generic backstop)", async () => {
      const { WebSocketServer, WebSocket: NodeWebSocket } = await import("ws");
      server = new Server({ host: "127.0.0.1", swagger: false });
      await listenEphemeral(server);
      const nodeServer = server.getNodeServer();
      const wss = new WebSocketServer({ server: nodeServer, path: "/ws" });
      wss.on("connection", (ws) => ws.send("hello"));

      const port = (nodeServer.address() as { port: number }).port;
      const client = new NodeWebSocket(`ws://127.0.0.1:${port}/ws`);
      await once(client, "open");
      await new Promise((r) => setTimeout(r, 100));

      const start = Date.now();
      await server.close({ timeoutMs: 500 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(50);
      expect(elapsed).toBeLessThan(1500);
      expect(server.isListening).toBe(false);
      wss.close();
    }, 10_000);

    it("resolves near-instantly when the app closes its own wss.clients in beforeClose", async () => {
      const { WebSocketServer, WebSocket: NodeWebSocket } = await import("ws");
      server = new Server({
        host: "127.0.0.1",
        swagger: false,
        nodeHttpClient: "http",
      });
      const nodeServer = server.getNodeServer();
      const wss = new WebSocketServer({ server: nodeServer, path: "/ws" });
      wss.on("connection", (ws) => ws.send("hello"));
      server.beforeClose(() => {
        for (const c of wss.clients) c.terminate();
      });

      await listenEphemeral(server);
      const port = (nodeServer.address() as { port: number }).port;
      const client = new NodeWebSocket(`ws://127.0.0.1:${port}/ws`);
      await once(client, "open");
      await new Promise((r) => setTimeout(r, 100));

      // Default (10s) timeoutMs - if this resolves fast, it's the beforeClose cleanup doing
      // the work, not the generic backstop timing out.
      const start = Date.now();
      await server.close();
      expect(Date.now() - start).toBeLessThan(500);
      wss.close();
    }, 10_000);
  },
);

describeNode("Server.close() - graceful HTTP drain (Node)", () => {
  it("lets an in-flight request finish before resolving", async () => {
    server = new Server({ host: "127.0.0.1", swagger: false });
    router.get("/slow", async (_req, res) => {
      await new Promise((r) => setTimeout(r, 300));
      res.ok({ done: true });
    });
    await listenEphemeral(server);
    const port = (server.getNodeServer().address() as { port: number }).port;

    const responsePromise = fetch(`http://127.0.0.1:${port}/slow`);
    await new Promise((r) => setTimeout(r, 50));

    const closePromise = server.close();
    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: true });
    await closePromise;
  }, 10_000);
});

describeNode("Server.close() - idempotency and hook contract (Node)", () => {
  it("a second close() call resolves without hanging or throwing", async () => {
    server = new Server({ host: "127.0.0.1", swagger: false });
    await listenEphemeral(server);

    await server.close();
    await expect(server.close()).resolves.toBeUndefined();
  });

  it("a throwing beforeClose hook still closes the transport and rejects close()", async () => {
    server = new Server({ host: "127.0.0.1", swagger: false });
    server.beforeClose(() => {
      throw new Error("cleanup failed");
    });
    await listenEphemeral(server);
    const nodeServer = server.getNodeServer();

    await expect(server.close()).rejects.toThrow("cleanup failed");
    expect(server.isListening).toBe(false);
    expect(nodeServer.listening).toBe(false);
  });
});
