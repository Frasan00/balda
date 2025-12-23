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
  executeApolloGraphQLRequestWeb,
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
    const graphqlEnabled = this.graphql.isEnabled;
    const graphqlEndpoint = "/graphql";

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

        const match = router.find(req.method as HttpMethod, pathname);

        const baldaRequest = Request.fromRequest(req);
        baldaRequest.params = match?.params ?? {};
        baldaRequest.setQueryString(search);
        const forwardedFor = req.headers.get("x-forwarded-for");
        baldaRequest.ip = forwardedFor
          ? forwardedFor.split(",")[0].trim()
          : server.requestIP(req)?.address;

        await fetch?.call(this, baldaRequest, server);

        if (graphqlEnabled && pathname.startsWith(graphqlEndpoint)) {
          const apolloHandler = await this.ensureGraphQLHandler();
          if (apolloHandler) {
            const webRequest = baldaRequest.toWebApi();
            return executeApolloGraphQLRequestWeb(
              apolloHandler.server,
              webRequest,
              req.method,
              search,
              { req: baldaRequest, server },
            );
          }
        }

        if (websocket && baldaRequest.headers.get("upgrade") === "websocket") {
          const webRequest = baldaRequest.toWebApi();
          const success = server.upgrade(webRequest, { data: {} });
          if (success) {
            return;
          }
        }

        const baldaResponse = new Response();

        await executeMiddlewareChain(
          match?.middleware ?? [],
          match?.handler ??
            ((req, res) => {
              res.notFound({
                ...errorFactory(new RouteNotFoundError(req.url, req.method)),
              });
            }),
          baldaRequest,
          baldaResponse,
        );

        const webResponse = Response.toWebResponse(baldaResponse);
        return webResponse;
      },
      ...(websocket ? { websocket } : {}),
      ...rest,
    } as Parameters<typeof Bun.serve>[0]);

    this.url = this.runtimeServer.url.toString();
  }

  async close(): Promise<void> {
    if (!this.runtimeServer) {
      return;
    }

    await this.runtimeServer.stop();
  }
}
