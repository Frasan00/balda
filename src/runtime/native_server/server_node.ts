import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  createSecureServer as http2CreateSecureServer,
  createServer as http2CreateServer,
  type Http2ServerRequest,
  type Http2ServerResponse,
} from "node:http2";
import { createServer as httpsCreateServer } from "node:https";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { errorFactory } from "../../errors/error_factory.js";
import { RouteNotFoundError } from "../../errors/route_not_found.js";
import { GraphQL } from "../../graphql/graphql.js";
import { Request } from "../../server/http/request.js";
import { Response } from "../../server/http/response.js";
import { router } from "../../server/router/router.js";
import { NodeHttpClient } from "../../server/server_types.js";
import type { ServerInterface } from "./server_interface.js";
import type {
  HttpMethod,
  HttpsServerOptions,
  NodeServer,
  NodeTapOptions,
  ServerConnectInput,
  ServerRoute,
  ServerTapOptions,
} from "./server_types.js";
import {
  canHaveBody,
  createGraphQLHandlerInitializer,
  executeMiddlewareChain,
} from "./server_utils.js";

const pipeReadableStreamToNodeResponse = async (
  stream: WebReadableStream,
  res: ServerResponse,
): Promise<void> => {
  const nodeStream = Readable.fromWeb(stream);
  return pipeline(nodeStream, res);
};

export class ServerNode<H extends NodeHttpClient> implements ServerInterface {
  port: number;
  host: string;
  url: string;
  routes: ServerRoute[];
  tapOptions?: ServerTapOptions;
  runtimeServer: NodeServer;
  nodeHttpClient: H;
  httpsOptions?: HttpsServerOptions;
  graphql: GraphQL;
  private ensureGraphQLHandler: ReturnType<
    typeof createGraphQLHandlerInitializer
  >;

  constructor(input?: ServerConnectInput<H>) {
    this.routes = input?.routes ?? [];
    this.port = input?.port ?? 80;
    this.host = input?.host ?? "0.0.0.0";
    this.tapOptions = input?.tapOptions;
    this.nodeHttpClient = input?.nodeHttpClient ?? ("http" as H);
    this.httpsOptions =
      input?.nodeHttpClient === "https" ||
      input?.nodeHttpClient === "http2-secure"
        ? (input as unknown as ServerConnectInput<"https">)?.httpsOptions
        : undefined;

    this.graphql = input?.graphql ?? new GraphQL();
    this.ensureGraphQLHandler = createGraphQLHandlerInitializer(this.graphql);
    const protocol =
      this.nodeHttpClient === "https" || this.nodeHttpClient === "http2-secure"
        ? "https"
        : "http";
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

        const urlString = req.url!;
        const queryIndex = urlString.indexOf("?");
        const pathname =
          queryIndex === -1 ? urlString : urlString.slice(0, queryIndex);
        const search = queryIndex === -1 ? "" : urlString.slice(queryIndex + 1);

        // GraphQL handler
        if (
          this.graphql.isEnabled &&
          pathname.startsWith(
            this.graphql.getYogaOptions().graphqlEndpoint ?? "/graphql",
          )
        ) {
          const handler = await this.ensureGraphQLHandler();
          if (handler) {
            handler(req, httpResponse);
            return;
          }
        }

        const match = router.find(req.method as HttpMethod, pathname);

        // Filtering HTTP/2 pseudo-headers
        const filteredHeaders: Record<string, string> = {};
        for (const key in req.headers) {
          if (key.charCodeAt(0) === 58) {
            continue;
          }
          const value = req.headers[key];
          if (value !== undefined) {
            filteredHeaders[key] = Array.isArray(value)
              ? value.join(", ")
              : value;
          }
        }

        const request = new Request(`${this.url}${urlString}`, {
          method: req.method,
          body: canHaveBody(req.method)
            ? await this.readRequestBody(req)
            : undefined,
          headers: filteredHeaders,
        });

        // Extracting IP
        const forwardedFor = req.headers["x-forwarded-for"];
        request.ip =
          (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ??
          req.socket.remoteAddress;

        request.query = search
          ? Object.fromEntries(new URLSearchParams(search))
          : {};
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

        const body = responseResult.getBody();
        if (body instanceof ReadableStream) {
          httpResponse.writeHead(
            responseResult.responseStatus,
            responseResult.headers,
          );
          pipeReadableStreamToNodeResponse(
            body as unknown as WebReadableStream,
            httpResponse,
          );
          return;
        }

        httpResponse.writeHead(
          responseResult.responseStatus,
          responseResult.headers,
        );

        // Fast path for common body types
        if (
          body instanceof Buffer ||
          body instanceof Uint8Array ||
          typeof body === "string"
        ) {
          httpResponse.end(body);
        } else if (
          responseResult.headers["Content-Type"] === "application/json"
        ) {
          httpResponse.end(JSON.stringify(body));
        } else {
          httpResponse.end(body != null ? String(body) : undefined);
        }
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

    if (this.nodeHttpClient === "http2-secure") {
      if (!this.httpsOptions) {
        throw new Error(
          "httpsOptions (key, cert) are required when using http2-secure client",
        );
      }
      return http2CreateSecureServer(
        this.httpsOptions,
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
