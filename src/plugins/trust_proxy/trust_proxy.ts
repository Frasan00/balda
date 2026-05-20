import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { TrustProxyOptions } from "./trust_proxy_types.js";

/**
 * Trust proxy middleware for consuming X-Forwarded-For headers safely.
 *
 * @example
 * // Single reverse proxy at 10.0.0.1
 * trustProxy({ trustedProxies: ['10.0.0.1'] })
 *
 * @example
 * // Two proxy hops; proxies in a private subnet
 * trustProxy({ trustedProxies: ['10.0.0.0/8'], hops: 2 })
 */
export const trustProxy = (
  options: TrustProxyOptions,
): ServerRouteMiddleware => {
  if (
    !options ||
    !options.trustedProxies ||
    options.trustedProxies.length === 0
  ) {
    throw new Error(
      "trustProxy() requires `trustedProxies` — an explicit allowlist of trusted proxy IPs or CIDR ranges.",
    );
  }

  const trustedProxies = options.trustedProxies;
  const hops = Math.max(1, options?.hops ?? 1);
  const headerName = options?.header ?? "x-forwarded-for";

  return async (req: Request, _res: Response, next: NextFunction) => {
    const peerIp = req.ip;

    if (!peerIp || !isIpAllowed(peerIp, trustedProxies)) {
      // Direct peer is not in the trusted list — ignore XFF
      return next();
    }

    const header = req.rawHeaders.get(headerName);
    if (!header || typeof header !== "string") {
      return next();
    }

    const parts = header
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return next();
    }

    // Pick client IP: `hops` positions from the right end of the chain
    const clientIndex = parts.length - hops;
    const clientIp = parts[clientIndex >= 0 ? clientIndex : 0];
    req.ip = clientIp;

    return next();
  };
};

/**
 * Returns true if `ip` is contained in any of the `ranges` (exact or IPv4 CIDR).
 */
function isIpAllowed(ip: string, ranges: string[]): boolean {
  for (const range of ranges) {
    if (range.includes("/")) {
      if (ipv4InCidr(ip, range)) return true;
    } else {
      if (ip === range) return true;
    }
  }
  return false;
}

/**
 * Checks whether `ip` (an IPv4 address) falls within the given `cidr` block.
 * Returns false for malformed input or IPv6 addresses.
 */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [networkAddr, prefixStr] = cidr.split("/");
  if (!networkAddr || !prefixStr) return false;
  const prefix = Number.parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const ipNum = ipv4ToNumber(ip);
  const netNum = ipv4ToNumber(networkAddr);
  if (ipNum === null || netNum === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = Number.parseInt(part, 10);
    if (Number.isNaN(byte) || byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}
