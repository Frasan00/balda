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
  executeApolloGraphQLRequestNode,
  executeMiddlewareChain,
} from "./server_utils.js";
import type { CacheAdapter } from "../../cache/cache_adapter.js";
import { executeWithCache } from "../../cache/route_cache.js";

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
  cacheAdapter?: CacheAdapter;
  private ensureGraphQLHandler: ReturnType<
    typeof createGraphQLHandlerInitializer
  >;
  private readonly needsHeaderFiltering: boolean;

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
    this.cacheAdapter = input?.cacheAdapter;
    this.ensureGraphQLHandler = createGraphQLHandlerInitializer(this.graphql);
    const protocol =
      this.nodeHttpClient === "https" || this.nodeHttpClient === "http2-secure"
        ? "https"
        : "http";
    this.url = `${protocol}://${this.host}:${this.port}`;

    // Only HTTP/2 protocols need header filtering for pseudo-headers
    this.needsHeaderFiltering =
      this.nodeHttpClient === "http2" || this.nodeHttpClient === "http2-secure";

    const graphqlEnabled = this.graphql.isEnabled;
    const graphqlEndpoint = "/graphql";

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
        if (graphqlEnabled && pathname.startsWith(graphqlEndpoint)) {
          const apolloHandler = await this.ensureGraphQLHandler();
          if (apolloHandler) {
            const body = canHaveBody(req.method)
              ? await this.readRequestBody(req)
              : "";

            await executeApolloGraphQLRequestNode(
              apolloHandler.server,
              req.headers,
              req.method ?? "POST",
              body,
              search,
              { req },
              async (headers, status, responseBody) => {
                for (const [key, value] of headers) {
                  httpResponse.setHeader(key, value);
                }
                httpResponse.statusCode = status;

                if (typeof responseBody === "string") {
                  httpResponse.end(responseBody);
                } else {
                  for await (const chunk of responseBody) {
                    httpResponse.write(chunk);
                  }
                  httpResponse.end();
                }
              },
            );
            return;
          }
        }

        const match = router.find(req.method as HttpMethod, pathname);

        // Optimized header processing
        const filteredHeaders = this.processHeaders(req.headers);

        const request = new Request();
        request.url = `${this.url}${urlString}`;
        request.method = req.method!;
        if (canHaveBody(req.method)) {
          request.setNodeRequest(req);
        }
        request.headers = new Headers(filteredHeaders);

        request.ip = this.extractClientIp(req);

        // Lazy query parsing - only parse when accessed
        request.setQueryString(search);
        request.params = match?.params ?? {};

        const response = new Response();
        response.nodeResponse = httpResponse;
        response.setRouteResponseSchemas(match?.responseSchemas);

        // Use cache wrapper if cache options and adapter are available
        const responseResult =
          match?.cacheOptions && this.cacheAdapter
            ? await executeWithCache(
                this.cacheAdapter,
                match.cacheOptions,
                match.path!,
                match.middleware ?? [],
                match.handler ??
                  ((req, res) => {
                    res.notFound({
                      ...errorFactory(
                        new RouteNotFoundError(req.url, req.method),
                      ),
                    });
                  }),
                request,
                response,
              )
            : await executeMiddlewareChain(
                match?.middleware ?? [],
                match?.handler ??
                  ((req, res) => {
                    res.notFound({
                      ...errorFactory(
                        new RouteNotFoundError(req.url, req.method),
                      ),
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
          // Check if body is already a serialized string (from fast-json-stringify)
          httpResponse.end(
            typeof body === "string" ? body : JSON.stringify(body),
          );
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

  /**
   * Optimized header processing
   * Only filters HTTP/2 pseudo-headers when using HTTP/2 protocol
   */
  private processHeaders(
    headers: IncomingMessage["headers"],
  ): Record<string, string> {
    const result: Record<string, string> = {};

    if (this.needsHeaderFiltering) {
      const columnCharCode = ":".charCodeAt(0);
      // HTTP/2: Filter pseudo-headers (start with ':')
      for (const key in headers) {
        if (key.charCodeAt(0) === columnCharCode) {
          continue;
        }
        const value = headers[key];
        if (value !== undefined) {
          result[key] = Array.isArray(value) ? value.join(", ") : value;
        }
      }
      return result;
    }

    // HTTP/1.1: No pseudo-headers, just normalize arrays
    for (const key in headers) {
      const value = headers[key];
      if (value !== undefined) {
        result[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    }

    return result;
  }

  private extractClientIp(req: IncomingMessage): string | undefined {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0].trim()
        : forwardedFor.split(",")[0].trim();
    }

    return req.socket.remoteAddress;
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
