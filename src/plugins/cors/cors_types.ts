export type CorsMethods =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "OPTIONS"
  | "PATCH"
  | "HEAD";

/**
 * Options for CORS middleware, similar to Express.js
 */
export type CorsOptions = {
  /**
   * Configures the Access-Control-Allow-Origin CORS header, defaults to '*'
   */
  origin?:
    | string
    | RegExp
    | (string | RegExp)[]
    | ((
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean | string) => void,
      ) => void);
  /**
   * Configures the Access-Control-Allow-Methods CORS header. Defaults to 'GET,HEAD,PUT,PATCH,POST,DELETE'.
   */
  methods?: CorsMethods[] | string;
  /**
   * Configures the Access-Control-Allow-Headers CORS header. Defaults to allowing all requested headers.
   */
  allowedHeaders?: string[] | string;
  /**
   * Configures the Access-Control-Expose-Headers CORS header. Defaults to none.
   */
  exposedHeaders?: string[] | string;
  /**
   * Configures the Access-Control-Allow-Credentials CORS header. Defaults to false.
   */
  credentials?: boolean;
  /**
   * Configures the Access-Control-Max-Age CORS header. Defaults to undefined (not sent).
   */
  maxAge?: number;
  /**
   * Pass the CORS preflight response to the next handler. Defaults to false (ends response).
   */
  preflightContinue?: boolean;
  /**
   * Provides a status code to use for successful OPTIONS requests, if preflightContinue is false. Defaults to 204.
   */
  optionsSuccessStatus?: number;
};
