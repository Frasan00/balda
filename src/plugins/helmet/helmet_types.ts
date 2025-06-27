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
  xssFilter?: boolean;
  referrerPolicy?: false | string;
  crossOriginResourcePolicy?: false | string;
  crossOriginOpenerPolicy?: false | string;
  crossOriginEmbedderPolicy?: false | string;
  contentSecurityPolicy?: false | string;
}
