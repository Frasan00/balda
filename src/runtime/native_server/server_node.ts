import {
  createServer,
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { routeNotFoundError } from "../../errors/errors_constants";
import { Request } from "../../server/http/request";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type { HttpMethod, ServerConnectInput, ServerRoute } from "./server_types";
import { canHaveBody, executeMiddlewareChain } from "./server_utils";

export class ServerNode implements ServerInterface {
  port: number;
  host: string;
  url: string;
  routes: ServerRoute[];
  runtimeServer: HttpServer;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.host = input?.host ?? "0.0.0.0";
    this.url = `http://${this.host}:${this.port}`;
    this.runtimeServer = createServer(
      async (req: IncomingMessage, httpResponse: ServerResponse) => {
        if (!req.url) {
          httpResponse.writeHead(400, { "Content-Type": "application/json" });
          httpResponse.end(
            JSON.stringify({ error: "Invalid request: missing URL" }),
          );
          return;
        }

        const requestUrl = `http://${req.headers.host}${req.url}`;
        const request = new Request(requestUrl, {
          method: req.method,
          body: canHaveBody(req.method)
            ? await this.readRequestBody(req)
            : undefined,
          headers: req.headers as Record<string, string>,
        });

        const match = router.find(req.method as HttpMethod, req.url!);
        if (!match) {
          httpResponse.writeHead(routeNotFoundError.status, {
            "Content-Type": "application/json",
          });

          httpResponse.end(
            JSON.stringify({
              error: routeNotFoundError.error,
            }),
          );
          return;
        }

        const url = new URL(requestUrl);
        request.query = Object.fromEntries(url.searchParams.entries());
        request.params = match.params;

        const response = await executeMiddlewareChain(
          match.middleware,
          match.handler,
          request,
        );

        httpResponse.writeHead(
          response.nativeResponse.status,
          Object.fromEntries(response.nativeResponse.headers.entries()),
        );

        const body = await response.getBody();
        httpResponse.end(body);
      },
    );
  }

  listen(): void {
    this.runtimeServer.listen(this.port, this.host);
  }

  async close(): Promise<void> {
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

  private async readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("end", () => {
        resolve(body);
      });
    });
  }
}
