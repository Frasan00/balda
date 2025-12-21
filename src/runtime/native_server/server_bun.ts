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
        const url = new URL(req.url);
        const match = router.find(req.method as HttpMethod, url.pathname);

        const baldaRequest = Request.fromRequest(req);
        baldaRequest.params = match?.params ?? {};
        baldaRequest.query = Object.fromEntries(url.searchParams.entries());
        baldaRequest.ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          server.requestIP(req)?.address;

        // User input handler
        await fetch?.call(this, baldaRequest, server);

        // GraphQL handler
        if (
          this.graphql.isEnabled &&
          url.pathname.startsWith(
            this.graphql.getYogaOptions().graphqlEndpoint ?? "/graphql",
          )
        ) {
          const handler = await this.ensureGraphQLHandler();
          if (handler) {
            return handler.fetch(baldaRequest, { server });
          }
        }

        // ws upgrade handler - only attempt if websocket config exists and request is upgrade
        if (websocket && baldaRequest.headers.get("upgrade") === "websocket") {
          const success = server.upgrade(baldaRequest, { data: {} });
          if (success) {
            return;
          }
        }

        const response = await executeMiddlewareChain(
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
        );

        const responseHeaders = response.headers;
        if (responseHeaders["Content-Type"] === "application/json") {
          return Response.json(response.getBody(), {
            status: response.responseStatus,
            headers: response.headers,
          });
        }

        return new Response(response.getBody(), {
          status: response.responseStatus,
          headers: response.headers,
        });
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
