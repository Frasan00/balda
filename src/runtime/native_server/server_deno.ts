import { errorFactory } from "../../errors/error_factory.js";
import { RouteNotFoundError } from "../../errors/route_not_found.js";
import { GraphQL } from "../../graphql/graphql.js";
import { Request } from "../../server/http/request.js";
import { Response } from "../../server/http/response.js";
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
        const urlString = req.url;
        const protocolEnd = urlString.indexOf("://") + 3;
        const pathStart = urlString.indexOf("/", protocolEnd);
        const pathAndQuery =
          pathStart === -1 ? "/" : urlString.slice(pathStart);
        const queryIndex = pathAndQuery.indexOf("?");
        const pathname =
          queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
        const search =
          queryIndex === -1 ? "" : pathAndQuery.slice(queryIndex + 1);

        // GraphQL handler - check early before route matching
        if (
          this.graphql.isEnabled &&
          pathname.startsWith(
            this.graphql.getYogaOptions().graphqlEndpoint ?? "/graphql",
          )
        ) {
          const baldaRequest = Request.fromRequest(req);
          const graphqlHandler = await this.ensureGraphQLHandler();
          if (graphqlHandler) {
            return graphqlHandler.fetch(baldaRequest, { info });
          }
        }

        const match = router.find(req.method as HttpMethod, pathname);

        const baldaRequest = Request.fromRequest(req);
        baldaRequest.params = match?.params ?? {};
        // Lazy query parsing - only parse when accessed
        baldaRequest.setQueryString(search);
        baldaRequest.ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          info.remoteAddr?.hostname;

        // User input handler
        const handlerResponse = await handler?.(baldaRequest, info);
        if (handlerResponse) {
          return new globalThis.Response(null, { status: 426 });
        }

        // ws upgrade handler
        if (
          baldaRequest.headers.get("upgrade") === "websocket" &&
          this.tapOptions?.deno?.websocket
        ) {
          const { socket, response } = Deno.upgradeWebSocket(baldaRequest);

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

        const baldaResponse = await executeMiddlewareChain(
          match?.middleware ?? [],
          match?.handler ??
            ((baldaRequest, res) => {
              res.notFound({
                ...errorFactory(
                  new RouteNotFoundError(baldaRequest.url, baldaRequest.method),
                ),
              });
            }),
          baldaRequest,
          new Response(),
        );

        return Response.toWebResponse(baldaResponse);
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
