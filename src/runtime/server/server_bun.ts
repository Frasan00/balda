import { router } from "../router/router";
import type { ServerInterface } from "./server_interface";
import type {
  HttpMethod,
  ServerConnectInput,
  ServerRoute,
} from "./server_types";
import { executeMiddlewareChain } from "./server_utils";

export class ServerBun implements ServerInterface {
  declare port: number;
  declare hostname: string;
  declare host: string;
  declare url: string;
  declare routes: ServerRoute[];
  declare runtimeServer: ReturnType<typeof Bun.serve>;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.hostname = input?.host ?? "0.0.0.0";
    this.host = input?.host ?? "0.0.0.0";
  }

  listen(): void {
    this.runtimeServer = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: async (req: Request) => {
        const url = new URL(req.url);
        const match = router.findRoute(url.pathname, req.method as HttpMethod);
        if (!match) {
          return new Response("Not Found", { status: 404 });
        }
        req.params = match.params;
        const route = match.route;
        const response = await executeMiddlewareChain(
          route.middlewares ?? [],
          route.handler,
          req
        );

        return response.nativeResponse;
      },
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
