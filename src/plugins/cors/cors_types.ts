export type CorsMethods =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "OPTIONS"
  | "PATCH"
  | "HEAD";

/**
 * Options for CORS middleware.
 *
 * ⚠️ SECURITY NOTES:
 * - `origin` is required. The old insecure `'*'` default has been removed.
 * - `origin: '*'` combined with `credentials: true` throws at construction.
 * - Regex origins: ensure patterns are anchored (^ and $) to prevent suffix-match bypasses.
 *   Prefer an explicit string allowlist over regex.
 */
export type CorsOptions = {
  /**
   * Configures the Access-Control-Allow-Origin CORS header.
   *
   * - `'*'` — allow all origins (only for truly public APIs, cannot be used with credentials)
   * - `'https://example.com'` — exact single origin
   * - `['https://a.com', 'https://b.com']` — explicit allowlist (recommended for production)
   * - `/^https:\/\/[a-z]+\.example\.com$/` — anchored regex (use with caution)
   *
   * ⚠️ Regex patterns must be fully anchored. An unanchored pattern like
   * `/example\.com/` matches `https://evil.com/?x=example.com`.
   */
  origin: string | RegExp | (string | RegExp)[];
  /**
   * Configures the Access-Control-Allow-Methods CORS header.
   * Defaults to 'GET, HEAD, PUT, PATCH, POST, DELETE'.
   */
  methods?: CorsMethods[] | string;
  /**
   * Configures the Access-Control-Allow-Headers CORS header.
   * Defaults to `['Content-Type', 'Accept', 'Authorization']`.
   *
   * ⚠️ The old behavior of reflecting `Access-Control-Request-Headers` verbatim
   * has been removed — that allowed clients to bless arbitrary headers.
   * Set this explicitly to the headers your API actually needs.
   */
  allowedHeaders?: string[] | string;
  /**
   * Configures the Access-Control-Expose-Headers CORS header. Defaults to none.
   */
  exposedHeaders?: string[] | string;
  /**
   * Configures the Access-Control-Allow-Credentials CORS header. Defaults to false.
   *
   * ⚠️ Cannot be `true` when `origin` is `'*'`.
   */
  credentials?: boolean;
  /**
   * Configures the Access-Control-Max-Age CORS header. Defaults to undefined (not sent).
   * Recommended maximum: 600 seconds for sensitive endpoints.
   */
  maxAge?: number;
  /**
   * Pass the CORS preflight response to the next handler. Defaults to false (ends response).
   */
  preflightContinue?: boolean;
  /**
   * Provides a status code to use for successful OPTIONS requests, if preflightContinue is false.
   * Defaults to 204.
   */
  optionsSuccessStatus?: number;
  /**
   * Allow the special `null` origin (sent by sandboxed iframes and file:// pages).
   * Defaults to false. Only enable if you explicitly need to support these contexts.
   */
  allowNullOrigin?: boolean;
};
