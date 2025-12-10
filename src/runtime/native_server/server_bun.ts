import { errorFactory } from "src/errors/error_factory";
import { RouteNotFoundError } from "src/errors/route_not_found";
import { Request } from "../../server/http/request";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type {
  BunTapOptions,
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types";
import { executeMiddlewareChain } from "./server_utils";

export class ServerBun implements ServerInterface {
  port: number;
  hostname: string;
  host: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  declare url: string;
  declare runtimeServer: ReturnType<typeof Bun.serve>;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.hostname = input?.host ?? "0.0.0.0";
    this.host = input?.host ?? "0.0.0.0";
    this.url = `http://${this.host}:${this.port}`;
    this.tapOptions = input?.tapOptions;
  }

  listen(): void {
    const tapOptions = this.tapOptions?.bun;
    const { fetch, ...rest } = tapOptions ?? {};

    this.runtimeServer = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: async (req, server) => {
        const url = new URL(req.url);
        const match = router.find(req.method as HttpMethod, url.pathname);

        Request.enrichRequest(req as Request);
        req.params = match?.params ?? {};
        req.query = Object.fromEntries(url.searchParams.entries());
        (req as any).ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          server.requestIP(req)?.address;

        // User input handler
        await fetch?.call(this, req as unknown as Request, server);

        const response = await executeMiddlewareChain(
          match?.middleware ?? [],
          match?.handler ??
            ((req, res) => {
              res.notFound({
                ...errorFactory(new RouteNotFoundError(req.url, req.method)),
              });
            }),
          req as Request,
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
