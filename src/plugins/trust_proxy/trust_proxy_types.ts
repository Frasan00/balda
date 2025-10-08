export type TrustProxyOptions = {
  /** Enable using X-Forwarded-* headers to determine client IP */
  trust?: boolean;
  /** Header name to read the client IP chain from */
  header?: string;
  /** Select which IP from the chain to use: 'first' (client) or 'last' (closest proxy) */
  hop?: "first" | "last";
};
