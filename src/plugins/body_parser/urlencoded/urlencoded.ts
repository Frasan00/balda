import type { ServerRouteMiddleware } from "../../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../../server/http/next.js";
import type { Request } from "../../../server/http/request.js";
import type { Response } from "../../../server/http/response.js";
import { parseSizeLimit } from "../../../utils.js";
import type { UrlEncodedOptions } from "./urlencoded_types.js";

// 1MB in bytes
const DEFAULT_SIZE = 1024 * 1024;

/**
 * URL-encoded form data parser middleware
 * Parses application/x-www-form-urlencoded bodies and populates req.parsedBody
 * @param options URL-encoded parsing options
 * @param options.limit The maximum size of the URL-encoded body. Supports "5mb", "100kb" format. Defaults to "1mb".
 * @param options.extended Whether to parse extended syntax (objects and arrays). Defaults to false.
 * @param options.charset The character encoding to use when parsing. Defaults to 'utf8'.
 * @param options.allowEmpty Whether to allow empty values. Defaults to true.
 * @param options.parameterLimit Maximum number of parameters to parse. Defaults to 1000.
 */
export const urlencoded = (
  options?: UrlEncodedOptions,
): ServerRouteMiddleware => {
  const limit = parseSizeLimit(options?.limit, DEFAULT_SIZE) ?? DEFAULT_SIZE;
  const opts = {
    limit,
    extended: options?.extended ?? false,
    charset: options?.charset ?? "utf8",
    allowEmpty: options?.allowEmpty ?? true,
    parameterLimit: options?.parameterLimit ?? 1000,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return next();
    }

    // Check Content-Length header BEFORE parsing
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > opts.limit) {
      res.status(413).json({
        error: "Payload too large",
        message: "Request body exceeds the size limit",
      });
      return;
    }

    try {
      await parseUrlEncodedBody(req, opts);
      await next();
    } catch (error) {
      if (error instanceof Error && error.message.includes("limit")) {
        res.status(413).json({
          error: "Payload too large",
          message: "Request body exceeds the size limit",
        });
        return;
      }

      throw error;
    }
  };
};

/**
 * Parse URL-encoded body and populate req.body
 */
async function parseUrlEncodedBody(
  req: Request,
  opts: {
    limit: number;
    extended: boolean;
    charset: string;
    allowEmpty: boolean;
    parameterLimit: number;
  },
): Promise<void> {
  if (req.parsedBody || req.bodyUsed) {
    return;
  }

  const arrayBuffer = await req.arrayBuffer();

  // Check body size
  if (arrayBuffer.byteLength > opts.limit) {
    throw new Error(
      `Body size ${arrayBuffer.byteLength} exceeds limit ${opts.limit}`,
    );
  }

  const decoder = new TextDecoder(opts.charset);
  const bodyString = decoder.decode(arrayBuffer);
  const parsed = parseUrlEncodedString(bodyString, opts);
  req.parsedBody = parsed;
}

/**
 * Parse URL-encoded string into an object
 */
function parseUrlEncodedString(
  str: string,
  opts: {
    extended: boolean;
    allowEmpty: boolean;
    parameterLimit: number;
  },
): Record<string, any> {
  const result: Record<string, any> = {};
  const searchParams = new URLSearchParams(str);
  if (searchParams.size > opts.parameterLimit) {
    throw new Error(
      `Too many parameters: ${searchParams.size} exceeds limit ${opts.parameterLimit}`,
    );
  }

  for (const [key, value] of searchParams.entries()) {
    if (!opts.allowEmpty && value === "") {
      continue;
    }

    if (opts.extended) {
      setNestedValue(result, key, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Set nested value for extended mode (e.g., user[name]=john -> { user: { name: 'john' } })
 */
function setNestedValue(
  obj: Record<string, any>,
  key: string,
  value: string,
): void {
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  if (dangerousKeys.includes(key)) {
    return;
  }

  const keys = key.match(/\[([^\]]*)\]/g);
  if (!keys) {
    if (!dangerousKeys.includes(key)) {
      obj[key] = value;
    }
    return;
  }

  let current = obj;
  const baseKey = key.split("[")[0];

  // Security: Check base key
  if (dangerousKeys.includes(baseKey)) {
    return;
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const bracketKey = keys[i].slice(1, -1);

    // Security: Check each nested key
    if (dangerousKeys.includes(bracketKey)) {
      return;
    }

    if (!current[baseKey]) {
      current[baseKey] = {};
    }

    if (bracketKey === "") {
      if (!Array.isArray(current[baseKey])) {
        current[baseKey] = [];
      }
      current = current[baseKey];
      continue;
    }

    if (!current[baseKey][bracketKey]) {
      current[baseKey][bracketKey] = {};
    }

    current = current[baseKey][bracketKey];
  }

  const lastKey = keys[keys.length - 1].slice(1, -1);

  // Security: Check last key
  if (dangerousKeys.includes(lastKey)) {
    return;
  }

  if (lastKey === "") {
    if (!Array.isArray(current)) {
      current = [];
    }

    current.push(value);
    return;
  }

  current[lastKey] = value;
}
