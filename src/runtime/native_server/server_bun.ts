import { GraphQL } from "../../graphql/graphql.js";
import type { Request } from "../../server/http/request.js";
import type { ServerInterface } from "./server_interface.js";
import type {
  ServerCloseOptions,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types.js";
import {
  createFetchHandler,
  createGraphQLHandlerInitializer,
  DEFAULT_CLOSE_TIMEOUT_MS,
  withTimeout,
} from "./server_utils.js";

type BunUpgradeTracker = {
  server: Bun.Server<any>;
  readonly upgraded: boolean;
};

/**
 * Wraps the shared Bun.Server passed to a `tapOptions.bun.fetch` hook so balda can tell
 * whether the hook already upgraded this request - the flag must live on a per-request
 * wrapper, not the server object itself, since that's shared across concurrent requests.
 */
function createUpgradeTracker(server: Bun.Server<any>): BunUpgradeTracker {
  let upgraded = false;
  const proxiedServer = new Proxy(server, {
    get(target, property) {
      if (property === "upgrade") {
        return (request: globalThis.Request, options?: unknown) => {
          const success = (
            target.upgrade as (r: globalThis.Request, o?: unknown) => boolean
          )(request, options);
          upgraded ||= success;
          return success;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return {
    server: proxiedServer,
    get upgraded() {
      return upgraded;
    },
  };
}

export class ServerBun implements ServerInterface {
  port: number;
  hostname: string;
  host: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  graphql: GraphQL;
  declare runtimeServer: ReturnType<typeof Bun.serve>;
  private ensureGraphQLHandler: ReturnType<
    typeof createGraphQLHandlerInitializer
  >;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.hostname = input?.host ?? "0.0.0.0";
    this.host = input?.host ?? "0.0.0.0";
    this.tapOptions = input?.tapOptions;
    this.graphql = input?.graphql ?? new GraphQL();
    this.ensureGraphQLHandler = createGraphQLHandlerInitializer(this.graphql);
  }

  get url(): string {
    return `http://${this.host}:${this.port}`;
  }

  listen(): void {
    const tapOptions = this.tapOptions?.bun;
    const { fetch, websocket, ...rest } = tapOptions ?? {};

    const fetchHandler = createFetchHandler({
      graphql: this.graphql,
      ensureGraphQLHandler: this.ensureGraphQLHandler,
      attachConnInfo: (req: Request, server: Bun.Server<any>) =>
        req.setBunIpExtractor(req.toWebApi(), server),
      buildGraphQLContext: (req: Request, server: Bun.Server<any>) => ({
        req,
        server,
      }),
      tap: fetch
        ? async (req: Request, server: Bun.Server<any>) => {
            const upgradeTracker = createUpgradeTracker(server);
            const hookResult = await fetch.call(
              this,
              req,
              upgradeTracker.server,
            );

            if (upgradeTracker.upgraded) {
              return {};
            }
            if (hookResult instanceof globalThis.Response) {
              return { response: hookResult };
            }
            return undefined;
          }
        : undefined,
      tryUpgradeWebSocket: websocket
        ? (req: Request, server: Bun.Server<any>) => {
            if (req.rawHeaders.get("upgrade") !== "websocket") {
              return undefined;
            }
            // bun-types ties `.upgrade()`'s `data` option to the server's WebSocketData
            // generic; balda's `websocket` config isn't generic over that type (it's a
            // plain lifecycle object). Call `.upgrade()` as a real method (not detached -
            // Bun's native implementation requires `this` to be the actual server) and
            // only cast the options argument, same pattern
            // `test/server_functions/server-tap-hooks.test.ts` already uses for this call.
            const success = server.upgrade(req.toWebApi(), {
              data: {},
            } as any);
            return success ? {} : undefined;
          }
        : undefined,
    });

    this.runtimeServer = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: (req, server) => fetchHandler(req, server),
      ...(websocket ? { websocket } : {}),
      ...rest,
    } as Parameters<typeof Bun.serve>[0]);
  }

  /**
   * Closes the server, always settling within roughly `options.timeoutMs` (default 10s).
   *
   * Bun's WebSocket support is native (`tapOptions.bun.websocket`), and unlike Node's
   * bring-your-own `ws` library, there's no app-level way to unstick a plain `stop()` call
   * once a WebSocket connection is open - it hangs regardless of what the app does with its
   * own connected clients (confirmed: closing every tracked client first doesn't help,
   * `stop()` still waits on the underlying connection). `stop(true)` is the only thing that
   * actually closes it, so that's the force fallback here.
   */
  async close(options?: ServerCloseOptions): Promise<void> {
    if (!this.runtimeServer) {
      return;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;
    if (timeoutMs <= 0) {
      await this.runtimeServer.stop(true);
      return;
    }

    const outcome = await withTimeout(this.runtimeServer.stop(), timeoutMs);
    if (outcome === "timeout") {
      await this.runtimeServer.stop(true);
    }
  }
}
