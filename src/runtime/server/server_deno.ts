import { router } from "../router/router";
import type { ServerInterface } from "./server_interface";
import type {
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
} from "./server_types";
import { executeMiddlewareChain } from "./server_utils";

export class ServerDeno implements ServerInterface {
  declare port: number;
  declare hostname: string;
  declare host: string;
  declare url: string;
  declare routes: ServerRoute[];
  declare runtimeServer: ReturnType<typeof Deno.serve>;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.hostname = input?.host ?? "0.0.0.0";
    this.host = input?.host ?? "0.0.0.0";
  }

  listen(): void {
    this.runtimeServer = Deno.serve({
      port: this.port,
      hostname: this.hostname,
      handler: async (req) => {
        const url = new URL(req.url);
        const match = router.findRoute(url.pathname, req.method as HttpMethod);
        if (!match) {
          return new Response("Not Found", { status: 404 });
        }

        req.params = match.params;
        const route = match.route;
        const res = await executeMiddlewareChain(
          route.middlewares ?? [],
          route.handler,
          req
        );

        return res.nativeResponse;
      },
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
