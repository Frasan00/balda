import {
  createServer,
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
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
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body:
            req.method !== "GET" && req.method !== "HEAD"
              ? (req as unknown as ReadableStream)
              : undefined,
        });

        const match = router.findRoute(req.url!, req.method as any);

        if (!match) {
          httpResponse.writeHead(404, { "Content-Type": "text/plain" });
          httpResponse.end("Not Found");
          return;
        }

        (request as any).params = match.params;
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

        const body = response.getBody("buffer");
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
