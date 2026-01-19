import { logger } from "../../logger/logger.js";
import type { LogOptions } from "./log_types.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";

/**
 * Logs the request and response of the handler, can be set both on a specific route or on a global middleware.
 * @warning Only json objects and strings are logged from the request and response.
 */
export const log = (options?: LogOptions): ServerRouteMiddleware => {
  const logMiddleware = logger.child({ scope: "LogMiddleware" });
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (options?.logRequest ?? true) {
        logMiddleware.info({
          type: "request",
          requestId: req.id,
          method:
            (options?.requestPayload?.method ?? true) ? req.method : undefined,
          url: (options?.requestPayload?.url ?? true) ? req.url : undefined,
          ip: (options?.requestPayload?.ip ?? true) ? req.ip : undefined,
          headers:
            (options?.requestPayload?.headers ?? true)
              ? req.headers
              : undefined,
          body:
            (options?.requestPayload?.body ?? false)
              ? returnIfObjectOrString(body)
              : undefined,
        });
      }

      const startTime = performance.now();
      await next();
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (options?.logResponse ?? true) {
        logMiddleware.info({
          type: "response",
          requestId: req.id,
          status: options?.responsePayload?.status ?? res.responseStatus,
          duration: `${duration.toFixed(2)}ms`,
          body:
            (options?.responsePayload?.body ?? false)
              ? returnIfObjectOrString(res.getBody())
              : undefined,
          headers:
            (options?.responsePayload?.headers ?? false)
              ? res.headers
              : undefined,
        });
      }
    } catch (error) {
      logMiddleware.error(error);
      throw error;
    }
  };
};

function returnIfObjectOrString(value: any): any {
  if (typeof value === "string") {
    return value;
  }

  // must be Record<string, any> in order to be logged as json
  if (value && typeof value === "object" && value.constructor === Object) {
    return value;
  }

  return;
}
