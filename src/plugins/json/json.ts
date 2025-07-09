import { errorFactory } from "src/errors/error_factory";
import { JsonNotValidError } from "src/errors/json_not_valid";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import { canHaveBody } from "../../runtime/native_server/server_utils";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
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
    const arrayBuffer = req.rawBody;

    if (!arrayBuffer) {
      return next();
    }

    const byteLength = arrayBuffer.byteLength;
    if (!byteLength) {
      return next();
    }

    if (byteLength > sizeLimit) {
      const customErrorMessage = {
        status: 413,
        message: "ERR_REQUEST_BODY_TOO_LARGE",
        ...options?.customErrorMessage,
      };

      return res.status(customErrorMessage.status).json({
        error: customErrorMessage.message,
      });
    }

    try {
      const encoding = options?.encoding ?? "utf-8";
      const decodedBody = new TextDecoder(encoding).decode(arrayBuffer);
      req.body = JSON.parse(decodedBody);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return res.badRequest({
          ...errorFactory(new JsonNotValidError("Invalid JSON syntax")),
        });
      }

      return res.badRequest({
        ...errorFactory(new JsonNotValidError("Invalid request body encoding")),
      });
    }

    await next();
  };
};

function isJsonRequest(req: Request): boolean {
  const contentType = getContentType(req);
  if (!contentType) {
    return false;
  }

  const mimeType = parseMimeType(contentType);
  return mimeType === "application/json";
}

function getContentType(req: Request): string | null {
  const contentType =
    req.headers.get("content-type") ?? req.headers.get("Content-Type");
  if (!contentType) {
    return null;
  }

  if (Array.isArray(contentType)) {
    return contentType[0] || null;
  }

  return contentType;
}

function parseMimeType(contentType: string): string {
  const trimmed = contentType.trim();
  const semicolonIndex = trimmed.indexOf(";");

  if (semicolonIndex === -1) {
    return trimmed.toLowerCase();
  }

  return trimmed.substring(0, semicolonIndex).trim().toLowerCase();
}
