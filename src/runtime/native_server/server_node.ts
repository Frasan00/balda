import {
  createServer,
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { Readable } from "node:stream";
import { routeNotFoundError } from "../../errors/errors_constants";
import { Request } from "../../server/http/request";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type {
  HttpMethod,
  NodeTapOptions,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types";
import { canHaveBody, executeMiddlewareChain } from "./server_utils";

const isJsonResponse = (headers: Record<string, string>) => {
  const applicationJsonRegex = /^application\/json/;
  return (
    applicationJsonRegex.test(headers["content-type"] ?? "") ||
    applicationJsonRegex.test(headers["Content-Type"] ?? "")
  );
};

export class ServerNode implements ServerInterface {
  port: number;
  host: string;
  url: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  runtimeServer: HttpServer;

  constructor(input?: ServerConnectInput) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.host = input?.host ?? "0.0.0.0";
    this.url = `http://${this.host}:${this.port}`;
    this.tapOptions = input?.tapOptions;
    this.runtimeServer = createServer(
      async (
        req: IncomingMessage,
        httpResponse: ServerResponse
      ): Promise<void> => {
        // User input handler
        if (this.tapOptions) {
          const { options } = this.tapOptions as NodeTapOptions;
          await options?.(req);
        }

        const match = router.find(req.method as HttpMethod, req.url!);
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

        const requestUrl = `http://${req.headers.host}${req.url}`;
        const request = new Request(requestUrl, {
          method: req.method,
          body: canHaveBody(req.method)
            ? await this.readRequestBody(req)
            : undefined,
          headers: req.headers as Record<string, string>,
        });

        let forwardedFor = req.headers["x-forwarded-for"];
        if (Array.isArray(forwardedFor)) {
          forwardedFor = forwardedFor[0];
        }

        request.ip = forwardedFor ?? req.socket.remoteAddress;
        const url = new URL(requestUrl);
        request.query = Object.fromEntries(url.searchParams.entries());
        request.params = match.params;

        const response = await executeMiddlewareChain(
          match.middleware,
          match.handler,
          request
        );

        httpResponse.writeHead(response.responseStatus, response.headers);

        let body = await response.getBody();
        if (isJsonResponse(response.headers) && typeof body !== "string") {
          body = JSON.stringify(body);
        }

        if (body instanceof Readable) {
          body.pipe(httpResponse);
        } else {
          httpResponse.end(body);
        }
      }
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
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      req.on("error", reject);
      req.on("end", () => {
        resolve(Buffer.concat(chunks).toString());
      });
    });
  }
}
