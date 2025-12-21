export interface JsonOptions {
  /**
   * The maximum size of the JSON body in bytes.
   * If the body is larger than this limit, the request will be rejected.
   * Default: 100kb
   */
  sizeLimit?: `${number}mb` | `${number}kb`;

  /**
   * If true, the JSON body will be parsed as an empty object if it is empty.
   * Default: false (body will be undefined)
   */
  parseEmptyBodyAsObject?: boolean;

  /**
   * The custom error message to return when the JSON body is too large.
   * Default: response with status 413 and body { message: "ERR_REQUEST_BODY_TOO_LARGE" }
   */
  customErrorMessage?: {
    status?: number;
    message?: string;
  };
}
