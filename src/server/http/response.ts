import { CookieOptions } from "src/plugins/cookie/cookie_types";
import { NativeResponse } from "../../runtime/native_response";

export type ResponseStatus =
  // 2xx Success
  | 200 // OK
  | 201 // Created
  | 202 // Accepted
  | 204 // No Content
  | 206 // Partial Content

  // 3xx Redirection
  | 301 // Moved Permanently
  | 302 // Found (Temporary Redirect)
  | 303 // See Other
  | 304 // Not Modified
  | 307 // Temporary Redirect
  | 308 // Permanent Redirect

  // 4xx Client Errors
  | 400 // Bad Request
  | 401 // Unauthorized
  | 403 // Forbidden
  | 404 // Not Found
  | 405 // Method Not Allowed
  | 406 // Not Acceptable
  | 409 // Conflict
  | 410 // Gone
  | 413 // Payload Too Large
  | 415 // Unsupported Media Type
  | 422 // Unprocessable Entity
  | 429 // Too Many Requests

  // 5xx Server Errors
  | 500 // Internal Server Error
  | 501 // Not Implemented
  | 502 // Bad Gateway
  | 503 // Service Unavailable
  | 504 // Gateway Timeout
  | 505; // HTTP Version Not Supported;

export class Response {
  /**
   * The native response object that all runtimes use
   */
  nativeResponse: NativeResponse;

  /**
   * The status of the response
   */
  responseStatus: ResponseStatus;

  /**
   * The headers of the response
   */
  responseHeaders: Record<string, string>;

  /**
   * The body of the response
   */
  private body: any;

  constructor(status: ResponseStatus = 200) {
    this.responseStatus = status;
    this.nativeResponse = new NativeResponse();
    this.responseHeaders = {};
  }

  /**
   * Set a header for the response
   */
  setHeader(key: string, value: string): this {
    this.responseHeaders[key] = value;
    return this;
  }

  /**
   * Set the status of the response, status defaults to 200
   */
  status(status: ResponseStatus): this;
  status(status: number): this;
  status(status: ResponseStatus | number): this {
    this.responseStatus = status as ResponseStatus;
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
      return this.text(String(body));
    }

    if (body instanceof Date) {
      return this.text(body.toISOString());
    }

    if (body instanceof RegExp) {
      return this.text(body.toString());
    }

    if (typeof Buffer !== "undefined" && body instanceof Buffer) {
      return this.download(new Uint8Array(body));
    }

    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      return this.download(new Uint8Array(body));
    }

    if (typeof body === "object") {
      try {
        return this.json(body);
      } catch (error) {
        return this.text(String(body));
      }
    }

    if (typeof body === "function") {
      return this.text(body.toString());
    }

    if (typeof body === "symbol") {
      return this.text(body.toString());
    }

    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: this.responseHeaders,
    });
  }

  /**
   * Send a response with the given body without any content type or encoding (as is), status defaults to 200
   */
  raw(body: any): void {
    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: this.responseHeaders,
    });
  }

  /**
   * Send a response with the given text, status defaults to 200
   */
  text(body: string): void {
    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: { ...this.responseHeaders, "Content-Type": "text/plain" },
    });
  }

  /**
   * Send a response with the given JSON, status defaults to 200
   */
  json<T extends Record<string, unknown>>(body: T): void {
    this.body = JSON.stringify(body);
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: { ...this.responseHeaders, "Content-Type": "application/json" },
    });
  }

  /**
   * Send a response with the given HTML, status defaults to 200
   */
  html(body: string): void {
    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: { ...this.responseHeaders, "Content-Type": "text/html" },
    });
  }

  /**
   * Send a response with the given XML, status defaults to 200
   */
  xml(body: string): void {
    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: { ...this.responseHeaders, "Content-Type": "application/xml" },
    });
  }

  /**
   * Send a response with the given binary with Content-Type of application/octet-stream header, status defaults to 200
   */
  download(body: Uint8Array): void {
    this.body = body;
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
      headers: {
        ...this.responseHeaders,
        "Content-Type": "application/octet-stream",
      },
    });
  }

  /**
   * 2XX Success
   */
  ok(body: any): void {
    this.status(200).send(body);
  }

  /**
   * 201 Created
   */
  created(body: any): void {
    this.status(201).send(body);
  }

  /**
   * 202 Accepted
   */
  accepted(body: any): void {
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
  partialContent(body: any): void {
    this.status(206).send(body);
  }

  /**
   * 3XX Redirection
   */
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
  badRequest(body: any): void {
    this.status(400).send(body);
  }

  /**
   * 401 Unauthorized
   */
  unauthorized(body: any): void {
    this.status(401).send(body);
  }

  /**
   * 403 Forbidden
   */
  forbidden(body: any): void {
    this.status(403).send(body);
  }

  /**
   * 404 Not Found
   */
  notFound(body: any): void {
    this.status(404).send(body);
  }

  /**
   * 405 Method Not Allowed
   */
  methodNotAllowed(body: any): void {
    this.status(405).send(body);
  }

  /**
   * 406 Not Acceptable
   */
  notAcceptable(body: any): void {
    this.status(406).send(body);
  }

  /**
   * 409 Conflict
   */
  conflict(body: any): void {
    this.status(409).send(body);
  }

  /**
   * 410 Gone
   */
  gone(body: any): void {
    this.status(410).send(body);
  }

  /**
   * 413 Payload Too Large
   */
  payloadTooLarge(body: any): void {
    this.status(413).send(body);
  }

  /**
   * 415 Unsupported Media Type
   */
  unsupportedMediaType(body: any): void {
    this.status(415).send(body);
  }

  /**
   * 422 Unprocessable Entity
   */
  unprocessableEntity(body: any): void {
    this.status(422).send(body);
  }

  /**
   * 429 Too Many Requests
   */
  tooManyRequests(body: any): void {
    this.status(429).send(body);
  }

  /**
   * 5XX Server Errors
   */
  internalServerError(body: any): void {
    this.status(500).send(body);
  }

  /**
   * 501 Not Implemented
   */
  notImplemented(body: any): void {
    this.status(501).send(body);
  }

  /**
   * 502 Bad Gateway
   */
  badGateway(body: any): void {
    this.status(502).send(body);
  }

  /**
   * 503 Service Unavailable
   */
  serviceUnavailable(body: any): void {
    this.status(503).send(body);
  }

  /**
   * 504 Gateway Timeout
   */
  gatewayTimeout(body: any): void {
    this.status(504).send(body);
  }

  /**
   * 505 HTTP Version Not Supported
   */
  httpVersionNotSupported(body: any): void {
    this.status(505).send(body);
  }

  /**
   * Set a cookie for the response, does nothing if the cookie middleware is not registered
   */
  cookie(_name: string, _value: string, _options?: CookieOptions): void {}

  /**
   * Clear a cookie for the response, does nothing if the cookie middleware is not registered
   */
  clearCookie(_name: string, _options?: CookieOptions): void {}

  /**
   * Get the body of the response
   */
  getBody(): any {
    return this.body;
  }
}
