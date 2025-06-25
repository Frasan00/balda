import { NativeRequest } from "../../runtime/native_request";

export class Request extends NativeRequest {
  /**
   * The parameters of the request.
   */
  params: Record<string, string> = {};

  /**
   * The query parameters of the request.
   */
  query: Record<string, string> = {};

  /**
   * The raw body of the request. Only available for POST, PUT, PATCH and DELETE requests.
   */
  declare rawBody?: ArrayBuffer;

  /**
   * The parsed body of the request.
   */
  override body: any;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);

    Object.defineProperty(this, "body", {
      writable: true,
      configurable: true,
      value: undefined,
    });
  }
}
