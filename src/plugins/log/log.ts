import { logger } from "src/logger/logger";
import type { LogOptions } from "src/plugins/log/log_types";
import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import type { NextFunction } from "src/server/http/next";
import type { Request } from "src/server/http/request";
import type { Response } from "src/server/http/response";

/**
 * Logs the request and response of the handler, can be set both on a specific route or on a global middleware.
 * @warning Only json objects and strings are logged from the request and response.
 */
export const log = (options?: LogOptions): ServerRouteMiddleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (options?.logRequest ?? true) {
        logger.info({
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
        logger.info({
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
      logger.error(error);
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
