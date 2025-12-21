import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import { canHaveBody } from "../../runtime/native_server/server_utils.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";

/**
 * Middleware to parse the body of the request. GET, DELETE and OPTIONS requests are not parsed. Used internally by the server.
 * @internal
 */
export const bodyParser = (): ServerRouteMiddleware => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!canHaveBody(req.method)) {
      return next();
    }

    // Check if body has already been read to prevent "Body is unusable" error
    if (req.bodyUsed || req.rawBody !== undefined) {
      return next();
    }

    req.rawBody = await req.arrayBuffer();
    Object.defineProperty(req, "body", {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    return next();
  };
};
