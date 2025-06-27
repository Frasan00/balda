import { routeNotFoundError } from "../../errors/errors_constants";
import { Request } from "../../server/http/request";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type {
  DenoTapOptions,
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types";
import { executeMiddlewareChain } from "./server_utils";

export class ServerDeno implements ServerInterface {
  declare port: number;
  declare hostname: string;
  declare host: string;
  declare url: string;
  declare routes: ServerRoute[];
  declare runtimeServer: ReturnType<typeof Deno.serve>;
  declare tapOptions?: ServerTapOptions;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.hostname = input?.host ?? "0.0.0.0";
    this.host = input?.host ?? "0.0.0.0";
    this.tapOptions = input?.tapOptions;
  }

  listen(): void {
    const tapOptions = this.tapOptions?.options as DenoTapOptions["options"];
    const { handler, ...rest } = tapOptions ?? {};

    this.runtimeServer = Deno.serve({
      port: this.port,
      hostname: this.hostname,
      handler: async (req, info) => {
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
            },
          );
        }

        req.params = match.params;
        req.query = Object.fromEntries(url.searchParams.entries());
        (req as any).ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? info.remoteAddr?.hostname;

        // User input handler
        await handler?.(req, info);

        const res = await executeMiddlewareChain(
          match.middleware,
          match.handler,
          req as Request,
        );

        return res.nativeResponse;
      },
      ...rest,
    });

    this.url = this.runtimeServer.addr.hostname;
  }

  async close(): Promise<void> {
    if (!this.runtimeServer) {
      throw new Error("Server is not listening or not initialized");
    }

    await this.runtimeServer.shutdown();
  }
}
