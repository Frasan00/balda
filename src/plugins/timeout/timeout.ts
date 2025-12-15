import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { TimeoutOptions } from "./timeout_types.js";

/**
 * Timeout plugin middleware, used to timeout the request if it takes too long
 * It fills the req.timeout property with true if the request times out
 * @param options Timeout options
 * @param options.ms The timeout in milliseconds
 * @param options.status The status code to return if the request times out
 * @param options.message The message to return if the request times out
 */
export const timeout = (options: TimeoutOptions): ServerRouteMiddleware => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.timeout = false;
    const timer = setTimeout(() => {
      req.timeout = true;
    }, options.ms);

    try {
      await next();
    } finally {
      clearTimeout(timer);
    }
  };
};
