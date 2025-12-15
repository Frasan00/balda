import { type ServerResponse } from "node:http";
import { type CookieOptions } from "../../plugins/cookie/cookie_types.js";
import { getContentType } from "../../plugins/static/static.js";
import { nativeFile } from "../../runtime/native_file.js";
import { nativePath } from "../../runtime/native_path.js";

/**
 * The response object.
 * This is the main object that is passed to the handler function.
 * It contains the response body, status, headers, etc.
 * It also contains the methods to send the response.
 */
export class Response {
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

  constructor(status: number = 200) {
    this.responseStatus = status;
    this.headers = {};
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
  send(body: any): void {
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
        return this.json(body);
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
    this.headers = {
      ...this.headers,
      "Content-Type": "text/plain",
    };
  }

  /**
   * Send a response with the given JSON, status defaults to 200
   */
  json<T extends Record<string, unknown> | Array<unknown>>(body: T): void {
    this.body = body;
    this.headers = {
      ...this.headers,
      "Content-Type": "application/json",
    };
  }

  /**
   * Send a response with the given HTML, status defaults to 200
   */
  html(htmlString: string): void {
    this.body = htmlString;
    this.headers = {
      ...this.headers,
      "Content-Type": "text/html",
    };
  }

  /**
   * Send a response with the given XML, status defaults to 200
   */
  xml(body: string): void {
    this.body = body;
    this.headers = {
      ...this.headers,
      "Content-Type": "application/xml",
    };
  }

  /**
   * Send a response with the given binary with Content-Type of application/octet-stream header, status defaults to 200
   */
  download(body: Uint8Array | Buffer): void {
    this.body = body;
    this.headers = {
      ...this.headers,
      "Content-Type": "application/octet-stream",
    };
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
    this.headers = {
      ...this.headers,
      "Content-Type": mimeType,
    };
  }

  /**
   * 2XX Success
   */

  /**
   * 200 OK
   */
  ok(body?: any): void {
    this.status(200).send(body);
  }

  /**
   * 201 Created
   */
  created(body?: any): void {
    this.status(201).send(body);
  }

  /**
   * 202 Accepted
   */
  accepted(body?: any): void {
    this.status(202).send(body);
  }

  /**
   * 204 No Content
   */
  noContent(): void {
    this.status(204).send("");
  }

  /**
   * 206 Partial Content
   */
  partialContent(body?: any): void {
    this.status(206).send(body);
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
    this.status(304).send("");
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
  badRequest(body?: any): void {
    this.status(400).send(body);
  }

  /**
   * 401 Unauthorized
   */
  unauthorized(body?: any): void {
    this.status(401).send(body);
  }

  /**
   * 403 Forbidden
   */
  forbidden(body?: any): void {
    this.status(403).send(body);
  }

  /**
   * 404 Not Found
   */
  notFound(body?: any): void {
    this.status(404).send(body);
  }

  /**
   * 405 Method Not Allowed
   */
  methodNotAllowed(body?: any): void {
    this.status(405).send(body);
  }

  /**
   * 406 Not Acceptable
   */
  notAcceptable(body?: any): void {
    this.status(406).send(body);
  }

  /**
   * 409 Conflict
   */
  conflict(body?: any): void {
    this.status(409).send(body);
  }

  /**
   * 410 Gone
   */
  gone(body?: any): void {
    this.status(410).send(body);
  }

  /**
   * 413 Payload Too Large
   */
  payloadTooLarge(body?: any): void {
    this.status(413).send(body);
  }

  /**
   * 415 Unsupported Media Type
   */
  unsupportedMediaType(body?: any): void {
    this.status(415).send(body);
  }

  /**
   * 422 Unprocessable Entity
   */
  unprocessableEntity(body?: any): void {
    this.status(422).send(body);
  }

  /**
   * 429 Too Many Requests
   */
  tooManyRequests(body?: any): void {
    this.status(429).send(body);
  }

  /**
   * 5XX Server Errors
   */
  internalServerError(body?: any): void {
    this.status(500).send(body);
  }

  /**
   * 501 Not Implemented
   */
  notImplemented(body?: any): void {
    this.status(501).send(body);
  }

  /**
   * 502 Bad Gateway
   */
  badGateway(body?: any): void {
    this.status(502).send(body);
  }

  /**
   * 503 Service Unavailable
   */
  serviceUnavailable(body?: any): void {
    this.status(503).send(body);
  }

  /**
   * 504 Gateway Timeout
   */
  gatewayTimeout(body?: any): void {
    this.status(504).send(body);
  }

  /**
   * 505 HTTP Version Not Supported
   */
  httpVersionNotSupported(body?: any): void {
    this.status(505).send(body);
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
    this.headers = {
      ...this.headers,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...options?.customHeaders,
    };

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
   */
  getBody(): any {
    return this.body;
  }
}
