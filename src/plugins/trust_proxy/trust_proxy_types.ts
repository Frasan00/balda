export type TrustProxyOptions = {
  /**
   * Allowlist of trusted proxy IPs (exact match or IPv4 CIDR notation).
   * The direct peer's socket IP must appear in this list before any
   * X-Forwarded-For header is consumed.
   *
   * @example ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1']
   */
  trustedProxies: string[];

  /**
   * Number of trusted proxy hops in the X-Forwarded-For chain (counted from the right).
   * With hops = 1, the client IP is the last entry in the XFF list.
   * With hops = 2, the client IP is the second-to-last entry.
   * @default 1
   */
  hops?: number;

  /**
   * Header name to read the client IP chain from.
   * @default "x-forwarded-for"
   */
  header?: string;
};
