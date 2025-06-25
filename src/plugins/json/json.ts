import { invalidJsonError } from "src/errors/errors_constants";
import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import { canHaveBody } from "src/runtime/native_server/server_utils";
import type { NextFunction } from "src/server/http/next";
import type { Request } from "src/server/http/request";
import type { Response } from "src/server/http/response";
import type { JsonOptions } from "./json_options";

/**
 * Middleware to parse the JSON body of the request. GET, DELETE and OPTIONS requests are not parsed.
 * @param options - The options for the JSON middleware.
 */
export const json = (options?: JsonOptions): ServerRouteMiddleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isJsonRequest(req) || !canHaveBody(req.method)) {
      return next();
    }

    const sizeLimit = options?.sizeLimit ?? 5 * 1024 * 1024;
    const customErrorMessage = {
      status: 413,
      message: "ERR_REQUEST_BODY_TOO_LARGE",
      ...options?.customErrorMessage,
    };

    const arrayBuffer = req.rawBody;
    if (arrayBuffer && arrayBuffer.byteLength > sizeLimit) {
      return res.status(customErrorMessage.status).json({
        error: customErrorMessage.message,
      });
    }

    const decodedBody = new TextDecoder().decode(arrayBuffer);
    try {
      Object.defineProperty(req, "body", {
        value: JSON.parse(decodedBody),
        writable: false,
        configurable: true,
        enumerable: true,
      });
    } catch (error) {
      return res.status(invalidJsonError.status).json({
        error: invalidJsonError.error,
      });
    }

    await next();
  };
};

function isJsonRequest(req: Request) {
  const applicationJsonRegex = /^application\/json/;
  let contentType =
    req.headers.get("content-type") ?? req.headers.get("Content-Type");
  if (!contentType || !contentType.length) {
    return false;
  }

  if (Array.isArray(contentType)) {
    contentType = contentType[0];
  }

  return applicationJsonRegex.test(contentType ?? "");
}
