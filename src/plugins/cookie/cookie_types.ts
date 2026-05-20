/**
 * Cookie options for setting cookies
 */
export type CookieOptions = {
  /**
   * Domain for the cookie.
   * ⚠️ Must not contain CR, LF, semicolons, or other control chars.
   */
  domain?: string;
  /**
   * Path for the cookie.
   * ⚠️ Must not contain CR, LF, or semicolons.
   */
  path?: string;
  /**
   * Expiration date for the cookie.
   * ⚠️ Will throw if the Date is invalid (NaN getTime).
   */
  expires?: Date;
  /**
   * Max age in seconds for the cookie. Must be a non-negative integer.
   * Falsy values (including 0) are only skipped if undefined;
   * pass maxAge: 0 to immediately expire.
   */
  maxAge?: number;
  /**
   * Whether the cookie is secure (HTTPS only)
   * @default true
   *
   * ⚠️ Must be `true` when `sameSite` is `"None"`.
   */
  secure?: boolean;
  /**
   * Whether the cookie is HTTP only (prevents JavaScript access)
   * @default true
   */
  httpOnly?: boolean;
  /**
   * SameSite attribute for the cookie
   *
   * - "Strict": Most secure, cookie not sent on cross-site requests
   * - "Lax": Balanced, cookie sent on top-level navigation
   * - "None": Least secure, requires secure=true
   *
   * ⚠️ "None" requires `secure: true`; combination is rejected at runtime.
   */
  sameSite?: "Strict" | "Lax" | "None";
  /**
   * Whether this individual cookie should be signed.
   * The middleware must have `sign: true` and a `secret` set for this to work.
   * Overrides the global `sign` option for this cookie only.
   */
  signed?: boolean;
  /**
   * Priority for the cookie
   */
  priority?: "Low" | "Medium" | "High";
};

/**
 * Options for the cookie middleware
 */
export type CookieMiddlewareOptions = {
  /**
   * Secret key(s) for signing cookies.
   * - Provide a single string for static signing.
   * - Provide an array for key rotation: signing uses `secret[0]`,
   *   verification accepts any entry in the array.
   * Required when `sign` is enabled.
   */
  secret?: string | string[];
  /**
   * Default options applied to all cookies set via `res.cookie()`.
   */
  defaults?: CookieOptions;
  /**
   * Whether to enable cookie parsing (defaults to true)
   */
  parse?: boolean;
  /**
   * Whether to enable cookie signing by default for all cookies (defaults to false).
   * Individual cookies can override this via `CookieOptions.signed`.
   */
  sign?: boolean;
};
