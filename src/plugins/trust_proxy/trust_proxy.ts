import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import type { NextFunction } from "src/server/http/next";
import type { Request } from "src/server/http/request";
import type { Response } from "src/server/http/response";
import type { TrustProxyOptions } from "./trust_proxy_types";

/**
 * Trust proxy plugin middleware, used to trust the proxy headers to get the client ip
 * @param options Trust proxy options (all optional)
 * @param options.trust Whether to trust the proxy headers
 * @param options.header The header name to read the client IP chain from
 * @param options.hop The hop to use to get the client IP
 */

export const trustProxy = (
  options?: TrustProxyOptions,
): ServerRouteMiddleware => {
  const headerName = options?.header ?? "x-forwarded-for";
  const useTrust = options?.trust ?? true;
  const hop = options?.hop ?? "first";

  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!useTrust) {
      return next();
    }

    const header = req.headers.get(headerName);
    if (header && typeof header === "string") {
      const parts = header
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (parts.length) {
        req.ip = hop === "first" ? parts[0] : parts[parts.length - 1];
      }
    }

    return next();
  };
};
