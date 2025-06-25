export interface JsonOptions {
  /**
   * The maximum size of the JSON body in bytes.
   * If the body is larger than this limit, the request will be rejected.
   * Default: 5mb
   */
  sizeLimit?: number;

  /**
   * The custom error message to return when the JSON body is too large.
   * Default: response with status 413 and body { message: "ERR_REQUEST_BODY_TOO_LARGE" }
   */
  customErrorMessage?: {
    status?: number;
    message?: string;
  };
}
