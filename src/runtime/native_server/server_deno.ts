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

export class ServerDeno implements ServerInterface {
  declare port: number;
  declare hostname: string;
  declare host: string;
  declare routes: ServerRoute[];
  declare runtimeServer: ReturnType<typeof Deno.serve>;
  declare tapOptions?: ServerTapOptions;
  graphql: GraphQL;
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
    const tapOptions = this.tapOptions?.deno;
    const { handler, ...rest } = tapOptions ?? {};
    const websocketConfig = tapOptions?.websocket;

    const fetchHandler = createFetchHandler({
      graphql: this.graphql,
      ensureGraphQLHandler: this.ensureGraphQLHandler,
      attachConnInfo: (req: Request, info: unknown) =>
        req.setDenoIpExtractor(req.toWebApi(), info),
      buildGraphQLContext: (req: Request, info: unknown) => ({ req, info }),
      tap: handler
        ? async (req: Request, info: unknown) => {
            const hookResult = await handler(
              req.toWebApi() as Parameters<
                Parameters<typeof Deno.serve>[0]["handler"]
              >[0],
              info as Parameters<
                Parameters<typeof Deno.serve>[0]["handler"]
              >[1],
            );
            if (hookResult instanceof globalThis.Response) {
              return { response: hookResult };
            }
            return undefined;
          }
        : undefined,
      tryUpgradeWebSocket: websocketConfig
        ? (req: Request) => {
            if (req.rawHeaders.get("upgrade") !== "websocket") {
              return undefined;
            }

            const { socket, response } = Deno.upgradeWebSocket(req.toWebApi());

            // Set event handlers instead of calling them immediately
            if (websocketConfig.open) {
              socket.onopen = () => websocketConfig.open?.(socket);
            }
            if (websocketConfig.message) {
              socket.onmessage = (event) =>
                websocketConfig.message?.(socket, event.data);
            }
            if (websocketConfig.close) {
              socket.onclose = () => websocketConfig.close?.(socket);
            }

            return { response };
          }
        : undefined,
    });

    this.runtimeServer = Deno.serve({
      port: this.port,
      hostname: this.hostname,
      handler: (req, info) =>
        fetchHandler(req, info) as ReturnType<
          Parameters<typeof Deno.serve>[0]["handler"]
        >,
      ...rest,
    });
  }

  /**
   * Closes the server, always settling within roughly `options.timeoutMs` (default 10s).
   * `shutdown()` already drains gracefully on its own (no bug found here); this is a
   * consistency/backstop bound shared with the Node and Bun implementations.
   */
  async close(options?: ServerCloseOptions): Promise<void> {
    if (!this.runtimeServer) {
      return;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;
    if (timeoutMs <= 0) {
      // Deno's HttpServer exposes no force-close primitive to fall back to - shutdown()
      // is all there is, so there's nothing more to do than call it.
      await this.runtimeServer.shutdown();
      return;
    }

    await withTimeout(this.runtimeServer.shutdown(), timeoutMs);
  }
}
