import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import { canHaveBody } from "../../runtime/native_server/server_utils";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

/**
 * Middleware to parse the body of the request. GET, DELETE and OPTIONS requests are not parsed. Used internally by the server. Will always be applied.
 * @internal
 */
export const bodyParser = (): ServerRouteMiddleware => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!canHaveBody(req.method)) {
      return next();
    }

    req.rawBody = await req.arrayBuffer();
    Object.defineProperty(req, "body", {
      value: req.rawBody,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    await next();
  };
};
