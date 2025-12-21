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

export class ServerBun implements ServerInterface {
  port: number;
  hostname: string;
  host: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  graphql: GraphQL;
  declare url: string;
  declare runtimeServer: ReturnType<typeof Bun.serve>;
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
    const tapOptions = this.tapOptions?.bun;
    const { fetch, websocket, ...rest } = tapOptions ?? {};

    this.runtimeServer = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: async (req, server) => {
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

        // GraphQL handler
        if (
          this.graphql.isEnabled &&
          pathname.startsWith(
            this.graphql.getYogaOptions().graphqlEndpoint ?? "/graphql",
          )
        ) {
          const baldaRequest = Request.fromRequest(req);
          const handler = await this.ensureGraphQLHandler();
          if (handler) {
            return handler.fetch(baldaRequest, { server });
          }
        }

        const match = router.find(req.method as HttpMethod, pathname);

        const baldaRequest = Request.fromRequest(req);
        baldaRequest.params = match?.params ?? {};
        // Lazy query parsing - only parse when accessed
        baldaRequest.setQueryString(search);
        baldaRequest.ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          server.requestIP(req)?.address;

        // User input handler
        await fetch?.call(this, baldaRequest, server);

        // ws upgrade handler - only attempt if websocket config exists and request is upgrade
        if (websocket && baldaRequest.headers.get("upgrade") === "websocket") {
          const success = server.upgrade(baldaRequest, { data: {} });
          if (success) {
            return;
          }
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
      // Pass websocket config to Bun.serve if provided
      ...(websocket ? { websocket } : {}),
      ...(rest as any),
    });

    this.url = this.runtimeServer.url.toString();
  }

  async close(): Promise<void> {
    if (!this.runtimeServer) {
      throw new Error("Server is not listening or not initialized");
    }

    await this.runtimeServer.stop();
  }
}
