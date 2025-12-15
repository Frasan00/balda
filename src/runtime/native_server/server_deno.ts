import { errorFactory } from "../../errors/error_factory.js";
import { RouteNotFoundError } from "../../errors/route_not_found.js";
import { GraphQL } from "../../graphql/graphql.js";
import { Request } from "../../server/http/request.js";
import { router } from "../../server/router/router.js";
import type { ServerInterface } from "./server_interface.js";
import type {
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types.js";
import {
  createGraphQLHandlerInitializer,
  executeMiddlewareChain,
} from "./server_utils.js";

export class ServerDeno implements ServerInterface {
  declare port: number;
  declare hostname: string;
  declare host: string;
  declare url: string;
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
    this.url = `http://${this.host}:${this.port}`;
    this.tapOptions = input?.tapOptions;
    this.graphql = input?.graphql ?? new GraphQL();
    this.ensureGraphQLHandler = createGraphQLHandlerInitializer(this.graphql);
  }

  listen(): void {
    const tapOptions = this.tapOptions?.deno;
    const { handler, ...rest } = tapOptions ?? {};

    this.runtimeServer = Deno.serve({
      port: this.port,
      hostname: this.hostname,
      handler: async (req, info) => {
        const url = new URL(req.url);
        const match = router.find(req.method as HttpMethod, url.pathname);

        Request.enrichRequest(req as Request);
        req.params = match?.params ?? {};
        req.query = Object.fromEntries(url.searchParams.entries());
        (req as any).ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          info.remoteAddr?.hostname;

        // User input handler
        const handlerResponse = await handler?.(req, info);
        if (handlerResponse) {
          return new Response(null, { status: 426 });
        }

        // GraphQL handler
        if (
          this.graphql.isEnabled &&
          url.pathname.startsWith(
            this.graphql.getYogaOptions().graphqlEndpoint ?? "/graphql",
          )
        ) {
          const graphqlHandler = await this.ensureGraphQLHandler();
          if (graphqlHandler) {
            return graphqlHandler.fetch(req, { info });
          }
        }

        // ws upgrade handler
        if (
          req.headers.get("upgrade") === "websocket" &&
          this.tapOptions?.deno?.websocket
        ) {
          const { socket, response } = Deno.upgradeWebSocket(req);

          // Set event handlers instead of calling them immediately
          if (this.tapOptions?.deno?.websocket?.open) {
            socket.onopen = () =>
              this.tapOptions?.deno?.websocket?.open?.(socket);
          }

          if (this.tapOptions?.deno?.websocket?.message) {
            socket.onmessage = (event) => {
              this.tapOptions?.deno?.websocket?.message?.(socket, event.data);
            };
          }

          if (this.tapOptions?.deno?.websocket?.close) {
            socket.onclose = () =>
              this.tapOptions?.deno?.websocket?.close?.(socket);
          }

          return response;
        }

        const res = await executeMiddlewareChain(
          match?.middleware ?? [],
          match?.handler ??
            ((req, res) => {
              res.notFound({
                ...errorFactory(new RouteNotFoundError(req.url, req.method)),
              });
            }),
          req as Request,
        );

        const responseHeaders = res.headers;
        if (responseHeaders["Content-Type"] === "application/json") {
          return Response.json(res.getBody(), {
            status: res.responseStatus,
            headers: res.headers,
          });
        }

        return new Response(res.getBody(), {
          status: res.responseStatus,
          headers: res.headers,
        });
      },
      ...rest,
    });

    this.url = `http://${this.host}:${this.port}`;
  }

  async close(): Promise<void> {
    if (!this.runtimeServer) {
      throw new Error("Server is not listening or not initialized");
    }

    await this.runtimeServer.shutdown();
  }
}
