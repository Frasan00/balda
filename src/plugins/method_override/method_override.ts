import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { MethodOverrideOptions } from "./method_override_types.js";

const DEFAULT_METHODS = ["POST"];
const DEFAULT_HEADER = "X-HTTP-Method-Override";
const ALLOWED_OVERRIDE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
// Methods that mutate state — require cross-site check
const STATE_CHANGING_METHODS = ["PUT", "PATCH", "DELETE"];

/**
 * Method override middleware for supporting HTTP verbs like PUT/DELETE in clients that don't support them.
 *
 * ⚠️ CSRF risk: overriding to state-changing methods (PUT, PATCH, DELETE) via a browser form
 * can bypass CSRF protections. This middleware rejects cross-site requests by default
 * (based on Origin / Referer vs. Host). Disable with `disableCsrfCheck: true` only when
 * you have an independent CSRF defense layer.
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
  const disableCsrfCheck = options?.disableCsrfCheck ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const currentMethod = req.method.toUpperCase();

    if (!allowedMethods.includes(currentMethod)) {
      return next();
    }

    const overrideMethod = req.rawHeaders.get(headerName);

    if (!overrideMethod) {
      return next();
    }

    const normalizedOverride = overrideMethod.toUpperCase();
    if (!ALLOWED_OVERRIDE_METHODS.includes(normalizedOverride)) {
      return next();
    }

    // Cross-site check for state-changing overrides
    if (
      !disableCsrfCheck &&
      STATE_CHANGING_METHODS.includes(normalizedOverride)
    ) {
      const host = req.rawHeaders.get("host");
      const origin = req.rawHeaders.get("origin");
      const referer = req.rawHeaders.get("referer");

      const requestSite = origin || (referer ? extractOrigin(referer) : null);

      if (requestSite && host) {
        const requestHost = extractHostFromOrigin(requestSite);
        if (requestHost && requestHost !== host) {
          return res.forbidden("Cross-site method override rejected");
        }
      }
    }

    req.method = normalizedOverride;

    await next();
  };
};

function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

function extractHostFromOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    return parsed.host; // host includes port if non-standard
  } catch {
    return null;
  }
}
