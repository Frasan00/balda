import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { MethodOverrideOptions } from "./method_override_types.js";

const DEFAULT_METHODS = ["POST"];
const DEFAULT_HEADER = "X-HTTP-Method-Override";
const ALLOWED_OVERRIDE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Method override middleware for supporting HTTP verbs like PUT/DELETE in clients that don't support them
 *
 * @param options Method override middleware options
 */
export const methodOverride = (
  options?: MethodOverrideOptions,
): ServerRouteMiddleware => {
  const allowedMethods = (options?.methods ?? DEFAULT_METHODS).map((m) =>
    m.toUpperCase(),
  );
  const headerName = options?.header ?? DEFAULT_HEADER;

  return async (req: Request, res: Response, next: NextFunction) => {
    const currentMethod = req.method.toUpperCase();

    if (!allowedMethods.includes(currentMethod)) {
      return next();
    }

    const overrideMethod = req.headers.get(headerName);

    if (!overrideMethod) {
      return next();
    }

    const normalizedOverride = overrideMethod.toUpperCase();
    if (!ALLOWED_OVERRIDE_METHODS.includes(normalizedOverride)) {
      return next();
    }

    req.method = normalizedOverride;

    await next();
  };
};
