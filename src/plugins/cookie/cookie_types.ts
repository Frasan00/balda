/**
 * Cookie options for setting cookies
 */
export type CookieOptions = {
  /**
   * Domain for the cookie
   */
  domain?: string;
  /**
   * Path for the cookie
   */
  path?: string;
  /**
   * Expiration date for the cookie
   */
  expires?: Date;
  /**
   * Max age in seconds for the cookie
   */
  maxAge?: number;
  /**
   * Whether the cookie is secure (HTTPS only)
   */
  secure?: boolean;
  /**
   * Whether the cookie is HTTP only
   */
  httpOnly?: boolean;
  /**
   * SameSite attribute for the cookie
   */
  sameSite?: "Strict" | "Lax" | "None";
  /**
   * Whether the cookie should be signed
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
   * Secret key for signing cookies (required if using signed cookies)
   */
  secret?: string;
  /**
   * Default options for all cookies set by this middleware
   */
  defaults?: CookieOptions;
  /**
   * Whether to enable cookie parsing (defaults to true)
   */
  parse?: boolean;
  /**
   * Whether to enable cookie signing (defaults to false)
   */
  sign?: boolean;
};
