import { type ServerResponse } from "node:http";
import { type CookieOptions } from "../../plugins/cookie/cookie_types.js";
import { getContentType } from "../../plugins/static/static.js";
import { AjvStateManager } from "../../ajv/ajv.js";
import type { FastJsonStringifyFunction } from "../../ajv/fast_json_stringify_types.js";
import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import type { JSONSchema } from "../../plugins/swagger/swagger_types.js";
import { logger } from "../../logger/logger.js";
import { nativeFile } from "../../runtime/native_file.js";
import { nativePath } from "../../runtime/native_path.js";
import { ZodLoader } from "../../validator/zod_loader.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";

import type { ResponseBodyForStatus } from "../router/path_types.js";

/**
 * The response object with per-status-code type-safe response bodies.
 * When response schemas are provided (e.g. via swagger.responses), each shorthand
 * method (ok, created, notFound, etc.) is typed to its corresponding status code schema.
 * @template TResponseMap - Maps HTTP status codes to their inferred body types (defaults to Record<number, any>)
 */
export class Response<
  TResponseMap extends Record<number, any> = Record<number, any>,
> {
  static toWebResponse(response: Response): globalThis.Response {
    const body = response.getBody();
    const contentType = response.headers["Content-Type"]?.toLowerCase();

    // If body is already serialized JSON string (from fast-json-stringify), use it directly
    if (contentType === "application/json") {
      if (typeof body === "string") {
        // Already serialized by fast-json-stringify
        return new globalThis.Response(body, {
          status: response.responseStatus,
          headers: response.headers,
        });
      }

      return globalThis.Response.json(body, {
        status: response.responseStatus,
        headers: response.headers,
      });
    }

    return new globalThis.Response(body, {
      status: response.responseStatus,
      headers: response.headers,
    });
  }

  /**
   * The node http response object available only on the node runtime, useful for direct response manipulation
   * @warning undefined on other runtimes since they already use Web API Response object
   */
  declare nodeResponse: ServerResponse;

  /**
   * The status of the response
   */
  responseStatus: number;

  /**
   * The headers of the response
   */
  headers: Record<string, string>;

  /**
   * The body of the response
   */
  private body: any | Promise<any>;

  /**
   * Cached fast-json-stringify serializer function.
   * Created when a schema is provided and reused for subsequent responses.
   */
  #serializer?: FastJsonStringifyFunction;

  /**
   * Response schemas from route registration (swagger.responses).
   * Used for automatic fast JSON serialization without explicit schema passing.
   * @internal
   */
  #routeResponseSchemas?: Record<number, RequestSchema>;

  /**
   * Pre-resolved serializers keyed by status code.
   * @internal
   */
  #routeSerializers?: Map<number, FastJsonStringifyFunction>;

  constructor(status: number = 200) {
    this.responseStatus = status;
    this.headers = {};
  }

  /**
   * Set the route response schemas for automatic serialization.
   * @internal
   */
  setRouteResponseSchemas(schemas?: Record<number, RequestSchema>): void {
    this.#routeResponseSchemas = schemas;
    this.#routeSerializers =
      AjvStateManager.getOrCreateResponseSerializers(schemas) ?? undefined;
  }

  /**
   * Set a header for the response
   */
  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  /**
   * Set the status of the response, status defaults to 200
   */
  status(status: number): this {
    this.responseStatus = status;
    return this;
  }

  /**
   * Send a response with the given body, tries to determine the content type based on the body type, status defaults to 200
   * @warning If cannot determine the content type, it will be sent as is
   */
  send(body: TResponseMap[keyof TResponseMap]): void {
    if (body === null || body === undefined) {
      return this.text("");
    }

    if (typeof body === "string") {
      return this.text(body);
    }

    if (
      typeof body === "number" ||
      typeof body === "boolean" ||
      typeof body === "bigint"
    ) {
      return this.raw(body);
    }

    if (typeof Buffer !== "undefined" && body instanceof Buffer) {
      return this.download(new Uint8Array(body));
    }

    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      return this.download(new Uint8Array(body));
    }

    if (typeof body === "object" && body !== null) {
      try {
        return this.json(body as any);
      } catch (error) {
        return this.text(String(body));
      }
    }

    if (typeof body === "symbol") {
      return this.text(body.toString());
    }

    this.body = body;
  }

  /**
   * Send a response with the given body without any content type or encoding (as is), status defaults to 200
   */
  raw(body: any): void {
    this.body = body;
  }

  /**
   * Send a response with the given text, status defaults to 200
   */
  text(body: string): void {
    this.body = body;
    this.headers["Content-Type"] = "text/plain";
  }

  /**
   * Send a response with the given JSON, status defaults to 200
   * @param body - The response body to serialize
   * @param schema - Optional schema for fast-json-stringify. When provided, enables fast serialization
   */
  json(body: TResponseMap[keyof TResponseMap], schema?: RequestSchema): void {
    this.body = body;
    this.headers["Content-Type"] = "application/json";

    // Fast path: pre-resolved route serializer if available
    if (!schema && this.#routeSerializers) {
      const preResolvedSerializer = this.#routeSerializers.get(
        this.responseStatus,
      );
      if (preResolvedSerializer) {
        this.#serializer = preResolvedSerializer;
        return;
      }
    }

    const effectiveSchema =
      schema ?? this.#routeResponseSchemas?.[this.responseStatus];

    if (effectiveSchema) {
      const { jsonSchema, prefix } =
        this.getJsonSchemaWithPrefix(effectiveSchema);
      this.#serializer =
        AjvStateManager.getOrCreateSerializer(jsonSchema, prefix) ?? undefined;
    }
  }

  /**
   * Send a response with the given HTML, status defaults to 200
   */
  html(htmlString: string): void {
    this.body = htmlString;
    this.headers["Content-Type"] = "text/html";
  }

  /**
   * Send a response with the given XML, status defaults to 200
   */
  xml(body: string): void {
    this.body = body;
    this.headers["Content-Type"] = "application/xml";
  }

  /**
   * Send a response with the given binary with Content-Type of application/octet-stream header, status defaults to 200
   */
  download(body: Uint8Array | Buffer): void {
    this.body = body;
    this.headers["Content-Type"] = "application/octet-stream";
  }

  /**
   * Send a response with the given file content, status defaults to 200
   * @param options only affects node and bun environment
   */
  file(
    pathToFile: string,
    options?: {
      encoding?: string;
      flag?: string;
    },
  ): void {
    const ext = nativePath.extName(pathToFile);
    const mimeType = getContentType(ext);
    this.body = nativeFile.file(pathToFile, options);
    this.headers["Content-Type"] = mimeType;
  }

  /**
   * 2XX Success
   */

  /**
   * 200 OK
   */
  ok(body?: ResponseBodyForStatus<TResponseMap, 200>): void {
    this.status(200).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 201 Created
   */
  created(body?: ResponseBodyForStatus<TResponseMap, 201>): void {
    this.status(201).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 202 Accepted
   */
  accepted(body?: ResponseBodyForStatus<TResponseMap, 202>): void {
    this.status(202).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 204 No Content
   */
  noContent(): void {
    this.responseStatus = 204;
    this.body = "";
  }

  /**
   * 206 Partial Content
   */
  partialContent(body?: ResponseBodyForStatus<TResponseMap, 206>): void {
    this.status(206).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 3XX Redirection
   */

  /**
   * 300 Multiple Choices
   */
  multipleChoices(url: string): void {
    this.status(300).setHeader("Location", url);
  }

  redirect(url: string): void {
    this.status(302).setHeader("Location", url);
  }

  /**
   * 301 Moved Permanently
   */
  movedPermanently(url: string): void {
    this.status(301).setHeader("Location", url);
  }

  /**
   * 302 Found (Temporary Redirect)
   */
  found(url: string): void {
    this.status(302).setHeader("Location", url);
  }

  /**
   * 303 See Other
   */
  seeOther(url: string): void {
    this.status(303).setHeader("Location", url);
  }

  /**
   * 304 Not Modified
   */
  notModified(): void {
    this.responseStatus = 304;
    this.body = "";
  }

  /**
   * 307 Temporary Redirect
   */
  temporaryRedirect(url: string): void {
    this.status(307).setHeader("Location", url);
  }

  /**
   * 308 Permanent Redirect
   */
  permanentRedirect(url: string): void {
    this.status(308).setHeader("Location", url);
  }

  /**
   * 4XX Client Errors
   */

  /**
   * 400 Bad Request
   */
  badRequest(body?: ResponseBodyForStatus<TResponseMap, 400>): void {
    this.status(400).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 401 Unauthorized
   */
  unauthorized(body?: ResponseBodyForStatus<TResponseMap, 401>): void {
    this.status(401).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 403 Forbidden
   */
  forbidden(body?: ResponseBodyForStatus<TResponseMap, 403>): void {
    this.status(403).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 404 Not Found
   */
  notFound(body?: ResponseBodyForStatus<TResponseMap, 404>): void {
    this.status(404).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 405 Method Not Allowed
   */
  methodNotAllowed(body?: ResponseBodyForStatus<TResponseMap, 405>): void {
    this.status(405).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 406 Not Acceptable
   */
  notAcceptable(body?: ResponseBodyForStatus<TResponseMap, 406>): void {
    this.status(406).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 409 Conflict
   */
  conflict(body?: ResponseBodyForStatus<TResponseMap, 409>): void {
    this.status(409).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 410 Gone
   */
  gone(body?: ResponseBodyForStatus<TResponseMap, 410>): void {
    this.status(410).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 413 Payload Too Large
   */
  payloadTooLarge(body?: ResponseBodyForStatus<TResponseMap, 413>): void {
    this.status(413).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 415 Unsupported Media Type
   */
  unsupportedMediaType(body?: ResponseBodyForStatus<TResponseMap, 415>): void {
    this.status(415).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 422 Unprocessable Entity
   */
  unprocessableEntity(body?: ResponseBodyForStatus<TResponseMap, 422>): void {
    this.status(422).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 429 Too Many Requests
   */
  tooManyRequests(body?: ResponseBodyForStatus<TResponseMap, 429>): void {
    this.status(429).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 5XX Server Errors
   */
  internalServerError(body?: ResponseBodyForStatus<TResponseMap, 500>): void {
    this.status(500).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 501 Not Implemented
   */
  notImplemented(body?: ResponseBodyForStatus<TResponseMap, 501>): void {
    this.status(501).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 502 Bad Gateway
   */
  badGateway(body?: ResponseBodyForStatus<TResponseMap, 502>): void {
    this.status(502).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 503 Service Unavailable
   */
  serviceUnavailable(body?: ResponseBodyForStatus<TResponseMap, 503>): void {
    this.status(503).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 504 Gateway Timeout
   */
  gatewayTimeout(body?: ResponseBodyForStatus<TResponseMap, 504>): void {
    this.status(504).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * 505 HTTP Version Not Supported
   */
  httpVersionNotSupported(
    body?: ResponseBodyForStatus<TResponseMap, 505>,
  ): void {
    this.status(505).send(body as TResponseMap[keyof TResponseMap]);
  }

  /**
   * Set a cookie for the response, cookie middleware must be registered in order to use this function
   */
  cookie?(_name: string, _value: string, _options?: CookieOptions): void;

  /**
   * Clear a cookie for the response, cookie middleware must be registered in order to use this function
   */
  clearCookie?(_name: string, _options?: CookieOptions): void;

  /**
   * Stream a response using an async generator or ReadableStream
   * Sets appropriate headers for Server-Sent Events by default
   */
  stream(
    source: AsyncGenerator<any> | Generator<any> | ReadableStream,
    options?: { customHeaders?: Record<string, string> },
  ): void {
    this.headers["Content-Type"] = "text/event-stream";
    this.headers["Cache-Control"] = "no-cache";
    this.headers["Connection"] = "keep-alive";
    if (options?.customHeaders) {
      for (const key in options.customHeaders) {
        this.headers[key] = options.customHeaders[key];
      }
    }

    if (source instanceof ReadableStream) {
      this.body = source;
      return;
    }

    this.body = new ReadableStream({
      async start(controller) {
        for await (const chunk of source) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }

        controller.close();
      },
    });
  }

  /**
   * Get the body of the response
   * If a fast serializer is available and the body is an object, it will be serialized lazily.
   */
  getBody(): any {
    // If we have a serializer and the body is an object, serialize it now
    if (
      this.#serializer &&
      typeof this.body === "object" &&
      this.body !== null
    ) {
      try {
        this.body = this.#serializer(this.body);
        // Clear the serializer after use to prevent re-serialization
        this.#serializer = undefined;
      } catch (error) {
        logger.error(
          {
            error,
            statusCode: this.responseStatus,
            contentType: this.headers["Content-Type"],
          },
          "Fast-json-stringify serialization failed, falling back to JSON.stringify",
        );
        // If serialization fails, fall back to returning the original body
        // The caller will handle JSON.stringify as a fallback
        this.#serializer = undefined;
      }
    }
    return this.body;
  }

  /**
   * Converts any schema type to JSON Schema format with appropriate prefix.
   * @param schema - The schema to convert
   * @returns Object with JSON Schema and prefix
   */
  private getJsonSchemaWithPrefix(schema: RequestSchema): {
    jsonSchema: JSONSchema;
    prefix: string;
  } {
    if (ZodLoader.isZodSchema(schema)) {
      return {
        jsonSchema: ZodLoader.toJSONSchema(schema),
        prefix: "fast_stringify_zod",
      };
    }

    if (TypeBoxLoader.isTypeBoxSchema(schema)) {
      return {
        jsonSchema: schema as JSONSchema,
        prefix: "fast_stringify_typebox",
      };
    }

    if (typeof schema === "object" && schema !== null) {
      return {
        jsonSchema: schema as JSONSchema,
        prefix: "fast_stringify_json",
      };
    }

    return {
      jsonSchema: { type: typeof schema } as JSONSchema,
      prefix: `fast_stringify_primitive_${JSON.stringify(schema)}`,
    };
  }
}
