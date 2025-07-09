import { logger } from "src/logger/logger";
import { MockResponse } from "src/mock/mock_response";
import { MockServerOptions } from "src/mock/mock_server_types";
import { HttpMethod } from "src/runtime/native_server/server_types";
import {
  canHaveBody,
  executeMiddlewareChain,
} from "src/runtime/native_server/server_utils";
import { Request } from "src/server/http/request";
import { Response } from "src/server/http/response";
import { router } from "src/server/router/router";
import type { Server } from "src/server/server";

/**
 * Allows to mock server requests without needing to start the server, useful for testing purposes
 */
export class MockServer {
  private readonly server: Server;

  constructor(server: Server) {
    this.server = server;
  }

  /**
   * Simulates an HTTP request without making an actual network call, useful for testing purposes
   * Executes the middleware chain and handler of the route
   * @param method - The HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param path - The request path
   * @param options - Request options including body, headers, query params, etc.
   * @throws {Error} - If more than one of body, formData, urlencoded is provided
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    options: MockServerOptions = {},
  ): Promise<MockResponse<T>> {
    const { headers = {}, query = {}, cookies = {}, ip } = options;
    this.validateOptions(options);

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

    let body = options.body;
    let contentType = "application/json";

    if (
      body &&
      typeof body === "object" &&
      !(body instanceof Uint8Array) &&
      !(body instanceof ArrayBuffer)
    ) {
      body = JSON.stringify(body);
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
    url.search = new URLSearchParams(query).toString();

    const req = new Request(url.toString(), {
      method: method.toUpperCase(),
      body: canHaveBody(method) ? body : undefined,
      headers: {
        "content-type": contentType,
        ...headers,
      },
    });

    req.query = { ...Object.fromEntries(url.searchParams.entries()), ...query };
    req.params = route.params;
    req.cookies = cookies;
    req.ip = ip;

    try {
      const res = await executeMiddlewareChain(
        route.middleware,
        route.handler,
        req,
      );
      return new MockResponse(res);
    } catch (error) {
      logger.error(`Error processing mock request ${method} ${path}:`, error);
      const errorRes = new Response(500);
      errorRes.json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      });
      return new MockResponse(errorRes);
    }
  }

  async get<T>(
    path: string,
    options?: Omit<MockServerOptions, "body" | "formData" | "urlencoded">,
  ): Promise<MockResponse<T>> {
    return this.request("GET", path, options);
  }

  async post<T>(
    path: string,
    options?: MockServerOptions,
  ): Promise<MockResponse<T>> {
    return this.request("POST", path, options);
  }

  async put<T>(
    path: string,
    options?: MockServerOptions,
  ): Promise<MockResponse<T>> {
    return this.request("PUT", path, options);
  }

  async patch<T>(
    path: string,
    options?: MockServerOptions,
  ): Promise<MockResponse<T>> {
    return this.request("PATCH", path, options);
  }

  async delete<T>(
    path: string,
    options?: Omit<MockServerOptions, "body" | "formData">,
  ): Promise<MockResponse<T>> {
    return this.request("DELETE", path, options);
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

      if ((value as any) instanceof File) {
        disposition += `; filename="${(value as any).name}"`;
        contentType = `Content-Type: ${(value as any).type || "application/octet-stream"}\r\n`;
      }

      buffers.push(encoder.encode(`${disposition}\r\n${contentType}\r\n`));

      if ((value as any) instanceof File) {
        const arrayBuffer = await (value as any).arrayBuffer();
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
