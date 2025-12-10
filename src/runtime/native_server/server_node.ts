import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  createServer as http2CreateServer,
  type Http2ServerRequest,
  type Http2ServerResponse,
} from "node:http2";
import { createServer as httpsCreateServer } from "node:https";
import { errorFactory } from "src/errors/error_factory";
import { RouteNotFoundError } from "src/errors/route_not_found";
import { NodeHttpClient } from "src/server/server_types";
import { Request } from "../../server/http/request";
import { Response } from "../../server/http/response";
import { router } from "../../server/router/router";
import type { ServerInterface } from "./server_interface";
import type {
  HttpMethod,
  HttpsServerOptions,
  NodeServer,
  NodeTapOptions,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types";
import { canHaveBody, executeMiddlewareChain } from "./server_utils";

async function pipeReadableStreamToNodeResponse(
  stream: ReadableStream,
  res: ServerResponse,
) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        break;
      }
      res.write(value);
    }
  } catch (error) {
    res.destroy(error as Error);
  }
}

export class ServerNode<H extends NodeHttpClient> implements ServerInterface {
  port: number;
  host: string;
  url: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  runtimeServer: NodeServer;
  nodeHttpClient: H;
  httpsOptions?: HttpsServerOptions;

  constructor(input?: ServerConnectInput<H>) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.host = input?.host ?? "0.0.0.0";
    this.tapOptions = input?.tapOptions;
    this.nodeHttpClient = input?.nodeHttpClient ?? ("http" as H);
    this.httpsOptions =
      input?.nodeHttpClient === "https"
        ? (input as unknown as ServerConnectInput<"https">)?.httpsOptions
        : undefined;

    const protocol = this.nodeHttpClient === "https" ? "https" : "http";
    this.url = `${protocol}://${this.host}:${this.port}`;

    this.runtimeServer = this.createServer(
      async (
        req: IncomingMessage,
        httpResponse: ServerResponse,
      ): Promise<void> => {
        if (this.tapOptions && this.tapOptions.node) {
          const preHandler = this.tapOptions.node as NodeTapOptions;
          await preHandler?.(req);
        }

        const match = router.find(req.method as HttpMethod, req.url!);
        const request = new Request(`${this.url}${req.url}`, {
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

        const [_, search = ""] = req.url?.split("?", 2) ?? [];
        request.query = Object.fromEntries(new URLSearchParams(search));
        request.params = match?.params ?? {};

        const response = new Response();
        response.nodeResponse = httpResponse;

        const responseResult = await executeMiddlewareChain(
          match?.middleware ?? [],
          match?.handler ??
            ((req, res) => {
              res.notFound({
                ...errorFactory(new RouteNotFoundError(req.url, req.method)),
              });
            }),
          request,
          response,
        );

        if (httpResponse.headersSent || httpResponse.writableEnded) {
          return;
        }

        let body = responseResult.getBody();
        if (body instanceof ReadableStream) {
          pipeReadableStreamToNodeResponse(body, httpResponse);
          return;
        }

        if (body instanceof Buffer || body instanceof Uint8Array) {
          body = body;
        } else if (typeof body === "string") {
          body = body;
        } else if (
          responseResult.headers["Content-Type"] === "application/json" &&
          typeof body !== "string"
        ) {
          body = JSON.stringify(body);
        } else {
          body = String(body);
        }

        httpResponse.writeHead(
          responseResult.responseStatus,
          responseResult.headers,
        );
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
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("error", reject);
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    });
  }

  private createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  ): NodeServer {
    if (this.nodeHttpClient === "http") {
      return createServer(handler);
    }

    if (this.nodeHttpClient === "http2") {
      return http2CreateServer(
        handler as unknown as (
          req: Http2ServerRequest,
          res: Http2ServerResponse,
        ) => Promise<void>,
      );
    }

    if (!this.httpsOptions) {
      throw new Error(
        "httpsOptions (key, cert) are required when using https client",
      );
    }
    return httpsCreateServer(this.httpsOptions, handler);
  }
}
