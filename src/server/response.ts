import { NativeResponse } from "../runtime/native_response";

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
    this.nativeResponse = new NativeResponse(this.body, {
      status: this.responseStatus,
    });
    return this;
  }

  /**
   * Send a response with the given body, status defaults to 200
   */
  send(body: any): void {
    if (typeof body === "object" && body !== null) {
      return this.json(body);
    }

    if (typeof body === "string") {
      return this.text(body);
    }

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
   * Get the body of the response
   */
  getBody<T extends "string" | "buffer">(returnType: T): T {
    if (returnType === "string") {
      return this.body as T;
    }

    return this.body as T;
  }
}
