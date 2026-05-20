/**
 * Options for helmet middleware
 */
export interface HelmetOptions {
  dnsPrefetchControl?: boolean;
  frameguard?: boolean | { action: "DENY" | "SAMEORIGIN" | string };
  hsts?:
    | boolean
    | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  contentTypeOptions?: boolean;
  ieNoOpen?: boolean;
  /**
   * Controls the legacy X-XSS-Protection header.
   * Modern guidance is to omit this header (set to false).
   * @default false
   * @deprecated Use Content-Security-Policy instead.
   */
  xssLegacyHeader?: boolean;
  /** @deprecated Use xssLegacyHeader instead. */
  xssFilter?: boolean;
  referrerPolicy?: false | string;
  crossOriginResourcePolicy?: false | string;
  crossOriginOpenerPolicy?: false | string;
  crossOriginEmbedderPolicy?: false | string;
  /**
   * Content-Security-Policy header value.
   * Set to `false` to disable.
   * @default "default-src 'self'"
   */
  contentSecurityPolicy?: false | string;
  /**
   * Permissions-Policy header value.
   * Set to `false` to disable.
   * @default "camera=(), microphone=(), geolocation=()"
   */
  permissionsPolicy?: false | string;
  /**
   * Emit `Origin-Agent-Cluster: ?1` header to opt in to origin-keyed agent clusters.
   * @default true
   */
  originAgentCluster?: boolean;
}
