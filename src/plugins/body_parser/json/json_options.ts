export interface JsonOptions {
  /**
   * The maximum size of the JSON body in bytes.
   * Enforced at the stream level — not reliant on Content-Length header.
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

  /**
   * Maximum nesting depth of parsed JSON. Protects against stack-overflow via deeply-nested objects.
   * Default: 32
   */
  maxDepth?: number;

  /**
   * Maximum total number of object keys across all nesting levels.
   * Protects against hash-flooding / CPU DoS via huge key counts.
   * Default: 10000
   */
  maxKeys?: number;
}
