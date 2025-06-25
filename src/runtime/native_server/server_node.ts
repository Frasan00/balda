import {
  createServer,
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { routeNotFoundError } from "../../errors/errors_constants";
import { router } from "../router/router";
import type { ServerInterface } from "./server_interface";
import type { ServerConnectInput, ServerRoute } from "./server_types";
import { executeMiddlewareChain } from "./server_utils";

export class ServerNode implements ServerInterface {
  declare port: number;
  declare host: string;
  declare url: string;
  declare routes: ServerRoute[];
  declare runtimeServer: HttpServer;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.host = input?.host ?? "0.0.0.0";
    this.url = `http://${this.host}:${this.port}`;
  }

  listen(): void {
    this.runtimeServer = createServer(
      async (req: IncomingMessage, httpResponse: ServerResponse) => {
        if (!req.url) {
          httpResponse.writeHead(400, { "Content-Type": "application/json" });
          httpResponse.end(
            JSON.stringify({ error: "Invalid request: missing URL" })
          );
          return;
        }

        const requestUrl = `http://${req.headers.host}${req.url}`;
        const request = new Request(requestUrl, {
          method: req.method,
          headers: req.headers as Record<string, string>,
        });

        const match = router.findRoute(req.url!, req.method as any);
        if (!match) {
          httpResponse.writeHead(routeNotFoundError.status, {
            "Content-Type": "application/json",
          });

          httpResponse.end(
            JSON.stringify({
              error: routeNotFoundError.error,
            })
          );
          return;
        }

        const url = new URL(requestUrl);
        request.params = match.params;
        request.query = Object.fromEntries(url.searchParams.entries());
        const route = match.route;

        const response = await executeMiddlewareChain(
          route.middlewares ?? [],
          route.handler,
          request
        );

        httpResponse.writeHead(
          response.nativeResponse.status,
          Object.fromEntries(response.nativeResponse.headers.entries())
        );

        const body = response.getBody();
        httpResponse.end(body);
      }
    );

    this.runtimeServer.listen(this.port, this.host);
  }

  async close(): Promise<void> {
    if (!this.runtimeServer) {
      throw new Error("Server is not listening or not initialized");
    }

    return new Promise((resolve, reject) => {
      this.runtimeServer.close((err) => {
        if (err && "code" in err && err.code !== "ERR_SERVER_NOT_RUNNING") {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
