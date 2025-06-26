import { routeNotFoundError } from "../../errors/errors_constants";
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
    this.tapOptions = input?.tapOptions;
  }

  listen(): void {
    const tapOptions = this.tapOptions?.options as BunTapOptions["options"] | undefined;
    const { fetch, ...rest } = tapOptions ?? {};

    this.runtimeServer = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: async (req, server) => {
        Request.enrichRequest(req as Request);

        const url = new URL(req.url);
        const match = router.find(req.method as HttpMethod, url.pathname);
        if (!match) {
          return new Response(
            JSON.stringify({
              error: routeNotFoundError.error,
            }),
            {
              status: routeNotFoundError.status,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        req.params = match.params;
        req.query = Object.fromEntries(url.searchParams.entries());

        // User input handler
        await fetch?.(req, server);

        const response = await executeMiddlewareChain(
          match.middleware,
          match.handler,
          req as Request
        );

        return response.nativeResponse;
      },
      ...rest as any,
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
