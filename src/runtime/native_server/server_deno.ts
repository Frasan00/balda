import { errorFactory } from "src/errors/error_factory";
import { RouteNotFoundError } from "src/errors/route_not_found";
import { GraphQL } from "src/graphql/graphql";
import { Request } from "../../server/http/request";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type {
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types";
import {
  createGraphQLHandlerInitializer,
  executeMiddlewareChain,
} from "./server_utils";

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
