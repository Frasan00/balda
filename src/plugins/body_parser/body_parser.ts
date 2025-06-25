import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import type { NextFunction } from "src/server/next";
import type { Request } from "src/server/request";
import type { Response } from "src/server/response";
import { canHaveBody } from "src/runtime/native_server/server_utils";

/**
 * Middleware to parse the body of the request. GET, DELETE and OPTIONS requests are not parsed. Used internally by the server. Will always be applied.
 * @internal
 */
export const bodyParser = (): ServerRouteMiddleware => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!canHaveBody(req.method)) {
      return next();
    }

    const arrayBuffer = await req.arrayBuffer();
    req.rawBody = arrayBuffer;

    await next();
  };
};
