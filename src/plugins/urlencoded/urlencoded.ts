import type { UrlEncodedOptions } from "src/plugins/urlencoded/urlencoded_types";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

/**
 * URL-encoded form data parser middleware
 * Parses application/x-www-form-urlencoded bodies and populates req.body
 * @param options URL-encoded parsing options
 * @param options.limit The maximum size of the URL-encoded body in bytes. Defaults to 1MB.
 * @param options.extended Whether to parse extended syntax (objects and arrays). Defaults to false.
 * @param options.charset The character encoding to use when parsing. Defaults to 'utf8'.
 * @param options.allowEmpty Whether to allow empty values. Defaults to true.
 * @param options.parameterLimit Maximum number of parameters to parse. Defaults to 1000.
 */
export const urlencoded = (
  options?: UrlEncodedOptions
): ServerRouteMiddleware => {
  const opts: Required<UrlEncodedOptions> = {
    limit: 1024 * 1024,
    extended: false,
    charset: "utf8",
    allowEmpty: true,
    parameterLimit: 1000,
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return next();
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

      res.status(400).json({
        error: "Bad request",
        message: "Invalid URL-encoded data",
      });
    }
  };
};

/**
 * Parse URL-encoded body and populate req.body
 */
async function parseUrlEncodedBody(
  req: Request,
  opts: Required<UrlEncodedOptions>
): Promise<void> {
  const arrayBuffer = req.rawBody!;

  if (arrayBuffer.byteLength > opts.limit) {
    throw new Error(
      `Body size ${arrayBuffer.byteLength} exceeds limit ${opts.limit}`
    );
  }

  const decoder = new TextDecoder(opts.charset);
  const bodyString = decoder.decode(arrayBuffer);
  const parsed = parseUrlEncodedString(bodyString, opts);
  req.body = parsed;
}

/**
 * Parse URL-encoded string into an object
 */
function parseUrlEncodedString(
  str: string,
  opts: Required<UrlEncodedOptions>
): Record<string, any> {
  const result: Record<string, any> = {};
  const pairs = str.split("&");

  if (pairs.length > opts.parameterLimit) {
    throw new Error(
      `Too many parameters: ${pairs.length} exceeds limit ${opts.parameterLimit}`
    );
  }

  for (const pair of pairs) {
    if (!pair) {
      continue;
    }

    const [key, value] = pair.split("=");
    if (!key) {
      continue;
    }

    const decodedKey = decodeURIComponent(key);
    const decodedValue = value ? decodeURIComponent(value) : "";

    if (!opts.allowEmpty && decodedValue === "") {
      continue;
    }

    if (opts.extended) {
      setNestedValue(result, decodedKey, decodedValue);
    } else {
      result[decodedKey] = decodedValue;
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
  value: string
): void {
  const keys = key.match(/\[([^\]]*)\]/g);
  if (!keys) {
    obj[key] = value;
    return;
  }

  let current = obj;
  const baseKey = key.split("[")[0];

  for (let i = 0; i < keys.length - 1; i++) {
    const bracketKey = keys[i].slice(1, -1);
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
  if (lastKey === "") {
    if (!Array.isArray(current)) {
      current = [];
    }

    current.push(value);
    return;
  }

  current[lastKey] = value;
}
