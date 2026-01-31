import { logger } from "../logger/logger.js";
import { HttpMethod } from "../runtime/native_server/server_types.js";
import {
  canHaveBody,
  createGraphQLHandlerInitializer,
  executeMiddlewareChain,
} from "../runtime/native_server/server_utils.js";
import { Request } from "../server/http/request.js";
import { Response } from "../server/http/response.js";
import { router } from "../server/router/router.js";
import type { Server } from "../server/server.js";
import { NodeHttpClient } from "../server/server_types.js";
import { MockResponse } from "./mock_response.js";
import type { MockServerOptions } from "./mock_server_types.js";
import { executeWithCache } from "../cache/route_cache.js";

/**
 * Allows to mock server requests without needing to start the server, useful for testing purposes
 */
export class MockServer {
  readonly server: Server<NodeHttpClient>;
  private readonly logger = logger.child({ scope: "MockServer" });
  private ensureGraphQLHandler: ReturnType<
    typeof createGraphQLHandlerInitializer
  >;

  constructor(server: Server<NodeHttpClient>) {
    this.server = server;
    this.ensureGraphQLHandler = createGraphQLHandlerInitializer(
      this.server.graphql,
    );
  }

  /**
   * Simulates an HTTP request without making an actual network call, useful for testing purposes
   * Executes the middleware chain and handler of the route
   * @param method - The HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param path - The request path
   * @param options - Request options including body, headers, query params, etc.
   * @throws {Error} - If more than one of body, formData, urlencoded is provided
   */
  async request<
    TResponse = any,
    TBody = any,
    TQuery extends Record<string, string> = any,
  >(
    method: HttpMethod,
    path: string,
    options: MockServerOptions<TBody, TQuery> = {},
  ): Promise<MockResponse<TResponse>> {
    const { headers = {}, query = {}, cookies = {}, ip } = options;
    this.validateOptions(options);

    const graphqlEnabled = this.server.graphql.isEnabled;
    const isGraphQLPath = path.startsWith("/graphql");

    if (graphqlEnabled && isGraphQLPath) {
      return this.handleGraphQLRequest<TResponse>(method, path, options);
    }

    const route = router.find(method.toUpperCase(), path);
    if (!route) {
      const res = new Response(404);
      res.json({
        caller: "MockServer",
        error: "Route not found",
        path,
        method,
      });
      return new MockResponse(res);
    }

    // Internal body can be transformed to various types (BodyInit compatible)
    let body: string | Uint8Array | ArrayBuffer | undefined = undefined;
    let contentType = "application/json";

    if (options.body !== undefined) {
      if (
        typeof options.body === "object" &&
        !(options.body instanceof Uint8Array) &&
        !(options.body instanceof ArrayBuffer)
      ) {
        body = JSON.stringify(options.body);
      } else {
        body = options.body as string | Uint8Array;
      }
    }

    if (options.formData) {
      const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
      contentType = `multipart/form-data; boundary=${boundary}`;

      const multipartBody = await this.formDataToMultipart(
        options.formData,
        boundary,
      );
      body = multipartBody;
    }

    if (options.urlencoded) {
      contentType = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.urlencoded).toString();
    }

    const url = new URL(
      `http://${this.server.host}:${this.server.port}${path}`,
    );

    // Merge existing query params from path with options.query
    // Only override url.search if options.query has keys
    if (Object.keys(query).length > 0) {
      // Merge path query params with options query params
      const existingParams = Object.fromEntries(url.searchParams.entries());
      const mergedQuery = { ...existingParams, ...query };
      url.search = new URLSearchParams(mergedQuery).toString();
    }

    const webRequest = new globalThis.Request(url.toString(), {
      method: method.toUpperCase(),
      body: canHaveBody(method) ? (body as BodyInit) : undefined,
      headers: {
        "content-type": contentType,
        ...headers,
      },
    });

    const req = Request.fromRequest(webRequest);
    req.query = Object.fromEntries(url.searchParams.entries());
    req.params = route.params;
    req.cookies = cookies;
    req.ip = ip;

    try {
      const res = new Response();

      // Use cache wrapper if cache options and adapter are available
      const cacheAdapter = this.server.serverOptions.cache?.adapter;
      if (route.cacheOptions && cacheAdapter) {
        await executeWithCache(
          cacheAdapter,
          route.cacheOptions,
          route.path!,
          route.middleware,
          route.handler,
          req,
          res,
        );
      } else {
        await executeMiddlewareChain(route.middleware, route.handler, req, res);
      }

      return new MockResponse(res);
    } catch (error) {
      this.logger.error(
        { error },
        `Error processing mock request ${method} ${path}:`,
      );
      const errorRes = new Response(500);
      errorRes.json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      });
      return new MockResponse(errorRes);
    }
  }

  /**
   * Type-safe GET request
   * @template TResponse - The response body type
   * @template TQuery - The query parameters type
   * @example
   * const res = await mock.get<UserResponse, { id: string }>("/users/123");
   */
  async get<TResponse = any, TQuery extends Record<string, string> = any>(
    path: string,
    options?: Omit<
      MockServerOptions<never, TQuery>,
      "body" | "formData" | "urlencoded"
    >,
  ): Promise<MockResponse<TResponse>> {
    return this.request<TResponse, never, TQuery>("GET", path, options);
  }

  /**
   * Type-safe POST request
   * @template TResponse - The response body type
   * @template TBody - The request body type
   * @template TQuery - The query parameters type
   * @example
   * const res = await mock.post<UserResponse, CreateUserInput>("/users", { body: { name: "John" } });
   */
  async post<
    TResponse = any,
    TBody = any,
    TQuery extends Record<string, string> = any,
  >(
    path: string,
    options?: MockServerOptions<TBody, TQuery>,
  ): Promise<MockResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>("POST", path, options);
  }

  /**
   * Type-safe PUT request
   * @template TResponse - The response body type
   * @template TBody - The request body type
   * @template TQuery - The query parameters type
   * @example
   * const res = await mock.put<UserResponse, UpdateUserInput>("/users/123", { body: { name: "Jane" } });
   */
  async put<
    TResponse = any,
    TBody = any,
    TQuery extends Record<string, string> = any,
  >(
    path: string,
    options?: MockServerOptions<TBody, TQuery>,
  ): Promise<MockResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>("PUT", path, options);
  }

  /**
   * Type-safe PATCH request
   * @template TResponse - The response body type
   * @template TBody - The request body type
   * @template TQuery - The query parameters type
   * @example
   * const res = await mock.patch<UserResponse, Partial<UpdateUserInput>>("/users/123", { body: { name: "Jane" } });
   */
  async patch<
    TResponse = any,
    TBody = any,
    TQuery extends Record<string, string> = any,
  >(
    path: string,
    options?: MockServerOptions<TBody, TQuery>,
  ): Promise<MockResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>("PATCH", path, options);
  }

  /**
   * Type-safe DELETE request (no body allowed per HTTP spec)
   * @template TResponse - The response body type
   * @template TQuery - The query parameters type
   * @example
   * const res = await mock.delete<DeleteResponse>("/users/123");
   */
  async delete<TResponse = any, TQuery extends Record<string, string> = any>(
    path: string,
    options?: Omit<MockServerOptions<never, TQuery>, "body" | "formData">,
  ): Promise<MockResponse<TResponse>> {
    return this.request<TResponse, never, TQuery>("DELETE", path, options);
  }

  /**
   * Converts FormData to a proper multipart/form-data body with boundaries
   */
  private async formDataToMultipart(
    formData: FormData,
    boundary: string,
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const buffers: Uint8Array[] = [];

    for (const [name, value] of formData.entries()) {
      buffers.push(encoder.encode(`--${boundary}\r\n`));

      let disposition = `Content-Disposition: form-data; name="${name}"`;
      let contentType = "";

      if ((value as unknown) instanceof File) {
        disposition += `; filename="${(value as unknown as File).name}"`;
        contentType = `Content-Type: ${(value as unknown as File).type || "application/octet-stream"}\r\n`;
      }

      buffers.push(encoder.encode(`${disposition}\r\n${contentType}\r\n`));

      if ((value as unknown) instanceof File) {
        const arrayBuffer = await (value as unknown as File).arrayBuffer();
        buffers.push(new Uint8Array(arrayBuffer));
        buffers.push(encoder.encode("\r\n"));
      } else {
        buffers.push(encoder.encode(`${String(value)}\r\n`));
      }
    }

    buffers.push(encoder.encode(`--${boundary}--\r\n`));

    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const multipartBody = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      multipartBody.set(buf, offset);
      offset += buf.byteLength;
    }

    return multipartBody;
  }

  private async handleGraphQLRequest<TResponse = any>(
    method: HttpMethod,
    path: string,
    options: MockServerOptions = {},
  ): Promise<MockResponse<TResponse>> {
    const apolloHandler = await this.ensureGraphQLHandler();
    if (!apolloHandler) {
      const res = new Response(500);
      res.json({
        errors: [{ message: "GraphQL handler not initialized" }],
      });
      return new MockResponse(res);
    }

    const { headers = {}, query = {} } = options;
    const url = new URL(
      `http://${this.server.host}:${this.server.port}${path}`,
    );
    url.search = new URLSearchParams(query).toString();

    let body: string | Uint8Array | ArrayBuffer | undefined = undefined;

    if (options.body !== undefined && canHaveBody(method)) {
      if (
        typeof options.body === "object" &&
        !(options.body instanceof Uint8Array) &&
        !(options.body instanceof ArrayBuffer)
      ) {
        body = JSON.stringify(options.body);
      } else {
        body = options.body as string | Uint8Array;
      }
    }

    const webRequest = new globalThis.Request(url.toString(), {
      method: method.toUpperCase(),
      body: body as BodyInit,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    });

    const req = Request.fromRequest(webRequest);
    req.query = { ...Object.fromEntries(url.searchParams.entries()), ...query };

    try {
      const { HeaderMap } = await import("@apollo/server");

      const apolloHeaders = new HeaderMap();
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
          apolloHeaders.set(
            key,
            Array.isArray(value) ? value.join(", ") : String(value),
          );
        }
      }

      const contentType = apolloHeaders.get("content-type") ?? "";
      const isJsonContent = contentType.includes("application/json");
      let bodyString = "";
      if (typeof body === "string") {
        bodyString = body;
      } else if (body instanceof Uint8Array) {
        bodyString = new TextDecoder().decode(body);
      } else if (body && typeof body === "object") {
        bodyString = new TextDecoder().decode(
          new Uint8Array(body as ArrayBuffer),
        );
      }

      const parsedBody =
        isJsonContent && bodyString ? JSON.parse(bodyString) : bodyString;

      const httpGraphQLRequest = {
        method: method.toUpperCase(),
        headers: apolloHeaders,
        body: parsedBody,
        search: url.search,
      };

      const apolloOptions = this.server.graphql.getApolloOptions() as any;
      const contextValue =
        apolloOptions.context && typeof apolloOptions.context === "function"
          ? await apolloOptions.context({ req })
          : { req };

      const result = await apolloHandler.server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: async () => contextValue,
      });

      const status = result.status ?? 200;
      const res = new Response(status);

      for (const [key, value] of result.headers) {
        res.setHeader(key, value);
      }

      if (result.body.kind === "complete") {
        const bodyContent = result.body.string;
        try {
          res.json(JSON.parse(bodyContent));
        } catch {
          res.text(bodyContent);
        }
      } else {
        let bodyContent = "";
        for await (const chunk of result.body.asyncIterator) {
          bodyContent += chunk;
        }
        try {
          res.json(JSON.parse(bodyContent));
        } catch {
          res.text(bodyContent);
        }
      }

      return new MockResponse(res);
    } catch (error) {
      this.logger.error(
        { error },
        `Error processing GraphQL request ${method} ${path}:`,
      );
      const errorRes = new Response(500);
      errorRes.json({
        errors: [{ message: "Internal server error" }],
      });
      return new MockResponse(errorRes);
    }
  }

  private validateOptions(options: MockServerOptions) {
    const { body, formData, urlencoded } = options;
    if (body && (formData || urlencoded)) {
      throw new Error("Only one of body, formData, urlencoded can be provided");
    }

    if (formData && (urlencoded || body)) {
      throw new Error("Only one of formData, urlencoded can be provided");
    }

    if (urlencoded && (body || formData)) {
      throw new Error("Only one of urlencoded, body can be provided");
    }
  }
}
