import { errorFactory } from "../../../errors/error_factory.js";
import { JsonNotValidError } from "../../../errors/json_not_valid.js";
import type { ServerRouteMiddleware } from "../../../runtime/native_server/server_types.js";
import { canHaveBody } from "../../../runtime/native_server/server_utils.js";
import type { NextFunction } from "../../../server/http/next.js";
import type { Request } from "../../../server/http/request.js";
import type { Response } from "../../../server/http/response.js";
import { parseSizeLimit } from "../../../utils.js";
import type { JsonOptions } from "./json_options.js";

// 100kb in bytes
const DEFAULT_SIZE = 100 * 1024;
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_KEYS = 10_000;

/**
 * Middleware to parse the JSON body of the request. GET, DELETE and OPTIONS requests are not parsed.
 * Size limit is enforced at the stream level — Content-Length is used only as a fast-reject hint.
 * @param options - The options for the JSON middleware.
 * @param options.sizeLimit - The maximum size of the JSON body. Default: 100kb
 * @param options.maxDepth - Maximum JSON nesting depth. Default: 32
 * @param options.maxKeys - Maximum total key count. Default: 10000
 */
export const json = (options?: JsonOptions): ServerRouteMiddleware => {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxKeys = options?.maxKeys ?? DEFAULT_MAX_KEYS;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isJsonRequest(req) || !canHaveBody(req.method)) {
      return next();
    }

    if (req.bodyUsed) {
      return next();
    }

    const sizeLimit =
      parseSizeLimit(options?.sizeLimit, DEFAULT_SIZE) ?? DEFAULT_SIZE;

    // Fast-reject: Content-Length header exceeds limit (may be absent or spoofed)
    const contentLength = req.rawHeaders.get("content-length");
    if (contentLength && Number.parseInt(contentLength) > sizeLimit) {
      const customErrorMessage = {
        status: 413,
        message: "ERR_REQUEST_BODY_TOO_LARGE",
        ...options?.customErrorMessage,
      };

      return res.status(customErrorMessage.status).json({
        error: customErrorMessage.message,
      });
    }

    if (req.body || req.bodyUsed) {
      return next();
    }

    try {
      const webRequest = req.toWebApi();
      const text = await readBodyWithCap(webRequest, sizeLimit);
      if (text === null) {
        const customErrorMessage = {
          status: 413,
          message: "ERR_REQUEST_BODY_TOO_LARGE",
          ...options?.customErrorMessage,
        };
        return res.status(customErrorMessage.status).json({
          error: customErrorMessage.message,
        });
      }

      const parsed: unknown = JSON.parse(text);
      validateDepthAndKeys(parsed, maxDepth, maxKeys, 0, { count: 0 });
      req.body = parsed;
      req.bodyUsed = true;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return res.badRequest({
          ...errorFactory(new JsonNotValidError("Invalid JSON syntax")),
        });
      }
      if (error instanceof RangeError) {
        return res.status(413).json({ error: error.message });
      }

      return res.badRequest({
        ...errorFactory(new JsonNotValidError("Invalid request body encoding")),
      });
    }

    await next();
  };
};

/**
 * Read the request body as text, rejecting if it exceeds capBytes.
 * Returns null if the cap is exceeded.
 */
async function readBodyWithCap(
  webRequest: globalThis.Request,
  capBytes: number,
): Promise<string | null> {
  const reader = webRequest.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > capBytes) {
        reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

/**
 * Walk the parsed JSON and enforce depth and key-count limits.
 * Throws RangeError if a limit is exceeded.
 */
function validateDepthAndKeys(
  value: unknown,
  maxDepth: number,
  maxKeys: number,
  depth: number,
  state: { count: number },
): void {
  if (depth > maxDepth) {
    throw new RangeError(`JSON depth limit (${maxDepth}) exceeded`);
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>);
    state.count += keys.length;
    if (state.count > maxKeys) {
      throw new RangeError(`JSON key count limit (${maxKeys}) exceeded`);
    }
    for (const key of keys) {
      validateDepthAndKeys(
        (value as Record<string, unknown>)[key],
        maxDepth,
        maxKeys,
        depth + 1,
        state,
      );
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      validateDepthAndKeys(item, maxDepth, maxKeys, depth + 1, state);
    }
  }
}

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
    req.rawHeaders.get("content-type") ?? req.rawHeaders.get("Content-Type");
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
