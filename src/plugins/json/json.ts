import { errorFactory } from "../../errors/error_factory.js";
import { JsonNotValidError } from "../../errors/json_not_valid.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import { canHaveBody } from "../../runtime/native_server/server_utils.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import { parseSizeLimit } from "../../utils.js";
import type { JsonOptions } from "./json_options.js";

// 100kb in bytes
const DEFAULT_SIZE = 100 * 1024;

/**
 * Middleware to parse the JSON body of the request. GET, DELETE and OPTIONS requests are not parsed.
 * @param options - The options for the JSON middleware.
 * @param options.sizeLimit - The maximum size of the JSON body. Default: 100kb
 */
export const json = (options?: JsonOptions): ServerRouteMiddleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isJsonRequest(req) || !canHaveBody(req.method)) {
      return next();
    }

    const sizeLimit =
      parseSizeLimit(options?.sizeLimit, DEFAULT_SIZE) ?? DEFAULT_SIZE;
    const arrayBuffer = req.rawBody;

    if (!arrayBuffer) {
      if (options?.parseEmptyBodyAsObject) {
        req.body = {};
      }

      return next();
    }

    const byteLength = arrayBuffer.byteLength;
    if (!byteLength) {
      if (options?.parseEmptyBodyAsObject) {
        req.body = {};
      }

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
