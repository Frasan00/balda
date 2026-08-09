import { afterEach, describe, expect, it } from "vitest";
import { Server } from "../../src/index.js";
import { Request as BaldaRequest } from "../../src/server/http/request.js";
import { router } from "../../src/server/router/router.js";
import { runtime } from "../../src/runtime/runtime.js";

/**
 * Regression coverage for a real bug: `tapOptions.bun.fetch` / `tapOptions.deno.handler`
 * had no way to reject a WebSocket upgrade (e.g. an Origin check) once the runtime's own
 * `websocket` lifecycle handlers were configured - the hook's return value was discarded
 * and balda upgraded the connection anyway. Deno additionally discarded any `Response` the
 * hook returned on *any* request, replacing it with a hardcoded 426.
 */

const describeBun = runtime.type === "bun" ? describe : describe.skip;
const describeDeno = runtime.type === "deno" ? describe : describe.skip;

let server: Server<"http"> | undefined;

afterEach(async () => {
  if (server?.isListening) {
    await server.close({ timeoutMs: 0 });
  }
  server = undefined;
  router.clearRoutes();
});

async function listenEphemeral(s: Server): Promise<void> {
  await s.waitUntilListening(0);
}

function wsOutcome(
  client: WebSocket,
): Promise<"open" | "rejected" | "timeout"> {
  return new Promise((resolve) => {
    client.onopen = () => resolve("open");
    client.onerror = () => resolve("rejected");
    client.onclose = () => resolve("rejected");
    setTimeout(() => resolve("timeout"), 1000);
  });
}

describeBun("tapOptions.bun.fetch hook", () => {
  it("rejects the WebSocket upgrade when the hook returns a Response (Origin denial)", async () => {
    let opened = false;
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          fetch: (req: BaldaRequest) => {
            if (
              req.rawHeaders.get("upgrade") === "websocket" &&
              req.rawHeaders.get("origin") !== "https://allowed.example"
            ) {
              return new Response("forbidden", { status: 403 });
            }
          },
          websocket: {
            open() {
              opened = true;
            },
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const outcome = await wsOutcome(client);

    expect(outcome).not.toBe("open");
    expect(opened).toBe(false);
  });

  it("still upgrades automatically when the hook returns nothing (backward compatibility)", async () => {
    let hookRan = false;
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          fetch: () => {
            hookRan = true;
          },
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

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await new Promise<string>((resolve) => {
      client.onmessage = (e) => resolve(e.data as string);
      client.onerror = () => resolve("ERROR");
    });

    expect(message).toBe("hello");
    expect(hookRan).toBe(true);
  });

  it("does not fall through to routing when the hook upgrades manually (no double upgrade)", async () => {
    let routeHits = 0;
    router.get("/", async (_req, res) => {
      routeHits++;
      res.ok({});
    });

    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          fetch: (req: BaldaRequest, bunServer: Bun.Server<any>) => {
            bunServer.upgrade(req.toWebApi(), { data: {} } as any);
          },
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
    const outcome = await wsOutcome(client);
    await new Promise((r) => setTimeout(r, 100));

    expect(outcome).toBe("open");
    expect(routeHits).toBe(0);
  });

  it("a Response from the hook short-circuits routing on a plain HTTP request", async () => {
    let routeHits = 0;
    router.get("/hooked", async (_req, res) => {
      routeHits++;
      res.ok({});
    });

    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          fetch: (req: BaldaRequest) => {
            if (new URL(req.url).pathname === "/hooked") {
              return new Response("teapot", { status: 418 });
            }
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const res = await fetch(`http://127.0.0.1:${port}/hooked`);
    expect(res.status).toBe(418);
    expect(await res.text()).toBe("teapot");
    expect(routeHits).toBe(0);
  });

  it("ignores a non-Response truthy return from the hook (legacy void-typed hooks)", async () => {
    router.get("/legacy", async (_req, res) => {
      res.ok({ hit: true });
    });

    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        bun: {
          fetch: ((req: unknown) => [req].length) as any,
        },
      },
    });
    await listenEphemeral(server);
    const port = server.getBunServer().port;

    const res = await fetch(`http://127.0.0.1:${port}/legacy`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hit: true });
  });
});

describeDeno("tapOptions.deno.handler hook", () => {
  it("rejects the WebSocket upgrade when the handler returns a Response (Origin denial)", async () => {
    let opened = false;
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        deno: {
          handler: (req) => {
            if (
              req.headers.get("upgrade") === "websocket" &&
              req.headers.get("origin") !== "https://allowed.example"
            ) {
              return new Response("forbidden", { status: 403 });
            }
          },
          websocket: {
            open() {
              opened = true;
            },
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = (
      server.getDenoServer() as unknown as { addr: { port: number } }
    ).addr.port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const outcome = await wsOutcome(client);

    expect(outcome).not.toBe("open");
    expect(opened).toBe(false);
  });

  it("still upgrades automatically when the handler returns nothing (backward compatibility)", async () => {
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        deno: {
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
    const port = (
      server.getDenoServer() as unknown as { addr: { port: number } }
    ).addr.port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await new Promise<string>((resolve) => {
      client.onmessage = (e) => resolve(e.data as string);
      client.onerror = () => resolve("ERROR");
    });

    expect(message).toBe("hello");
  });

  it("returns the handler's Response instead of a hardcoded 426", async () => {
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        deno: {
          handler: (req) => {
            if (new URL(req.url).pathname === "/hooked") {
              return new Response("teapot", { status: 418 });
            }
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = (
      server.getDenoServer() as unknown as { addr: { port: number } }
    ).addr.port;

    const res = await fetch(`http://127.0.0.1:${port}/hooked`);
    expect(res.status).toBe(418);
    expect(await res.text()).toBe("teapot");
  });

  it("lets the handler perform the upgrade itself and return the response", async () => {
    let opened = false;
    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        deno: {
          handler: (req) => {
            const { socket, response } = Deno.upgradeWebSocket(req);
            socket.onopen = () => {
              opened = true;
            };
            return response;
          },
          websocket: {
            open() {},
            message() {},
            close() {},
          },
        },
      },
    });
    await listenEphemeral(server);
    const port = (
      server.getDenoServer() as unknown as { addr: { port: number } }
    ).addr.port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const outcome = await wsOutcome(client);
    await new Promise((r) => setTimeout(r, 50));

    expect(outcome).toBe("open");
    expect(opened).toBe(true);
  });

  it("ignores a non-Response truthy return from the handler", async () => {
    router.get("/legacy", async (_req, res) => {
      res.ok({ hit: true });
    });

    server = new Server({
      host: "127.0.0.1",
      swagger: false,
      tapOptions: {
        deno: {
          handler: (() => "truthy") as any,
        },
      },
    });
    await listenEphemeral(server);
    const port = (
      server.getDenoServer() as unknown as { addr: { port: number } }
    ).addr.port;

    const res = await fetch(`http://127.0.0.1:${port}/legacy`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hit: true });
  });
});
