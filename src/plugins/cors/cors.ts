import { CorsOptions } from "src/plugins/cors/cors_types";
import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import type { Response } from "src/server/response";

/**
 * CORS plugin
 * @param options CORS options (all optional)
 */
export const cors = (options?: CorsOptions): ServerRouteMiddleware => {
  const opts: CorsOptions = {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders: "",
    exposedHeaders: "",
    credentials: false,
    maxAge: undefined,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    ...options,
  };

  return (req: Request, res: Response, next: () => void) => {
    const requestOrigin = req.headers.get("origin") || "";

    if (req.method === "OPTIONS") {
      return handlePreflightRequest(req, res, opts, requestOrigin, next);
    }

    handleRegularRequest(req, res, opts, requestOrigin);
    next();
  };
};

/**
 * Handle CORS preflight OPTIONS requests
 */
function handlePreflightRequest(
  _req: Request,
  res: Response,
  opts: CorsOptions,
  requestOrigin: string,
  next: () => void
): void {
  const allowOrigin = determineOrigin(opts, requestOrigin);

  if (!allowOrigin) {
    res.status(403);
    res.send("CORS origin not allowed");
    return;
  }

  // Set CORS headers for preflight
  setCorsHeaders(res, opts, allowOrigin);

  // Handle preflight continue option
  if (opts.preflightContinue) {
    next();
    return;
  }

  // End preflight request
  res.status(opts.optionsSuccessStatus || 204);
  res.send("");
}

/**
 * Handle regular CORS requests (non-OPTIONS)
 */
function handleRegularRequest(
  _req: Request,
  res: Response,
  opts: CorsOptions,
  requestOrigin: string
): void {
  const allowOrigin = determineOrigin(opts, requestOrigin);
  if (!allowOrigin) {
    return;
  }

  setCorsHeaders(res, opts, allowOrigin);
}

/**
 * Determine if origin is allowed and return the appropriate origin value
 */
function determineOrigin(
  opts: CorsOptions,
  requestOrigin: string
): string | false {
  // String origin
  if (typeof opts.origin === "string") {
    return opts.origin;
  }

  // Array of origins
  if (Array.isArray(opts.origin)) {
    const matchedOrigin = opts.origin.find((origin) =>
      typeof origin === "string"
        ? origin === requestOrigin
        : origin instanceof RegExp && origin.test(requestOrigin)
    );

    return typeof matchedOrigin === "string" ? matchedOrigin : false;
  }

  if (typeof opts.origin === "function") {
    try {
      return "*";
    } catch {
      return false;
    }
  }

  return "*";
}

/**
 * Set all CORS headers on the response
 */
function setCorsHeaders(
  res: Response,
  opts: CorsOptions,
  allowOrigin: string
): void {
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);

  if (opts.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (opts.exposedHeaders && opts.exposedHeaders !== "") {
    const exposedHeaders = Array.isArray(opts.exposedHeaders)
      ? opts.exposedHeaders.join(",")
      : opts.exposedHeaders;
    res.setHeader("Access-Control-Expose-Headers", exposedHeaders);
  }

  if (opts.allowedHeaders && opts.allowedHeaders !== "") {
    const allowedHeaders = Array.isArray(opts.allowedHeaders)
      ? opts.allowedHeaders.join(",")
      : opts.allowedHeaders;
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
  }

  const methodsStr = Array.isArray(opts.methods)
    ? opts.methods.join(",")
    : opts.methods;
  res.setHeader("Access-Control-Allow-Methods", String(methodsStr || ""));

  if (typeof opts.maxAge === "number") {
    res.setHeader("Access-Control-Max-Age", opts.maxAge.toString());
  }
}
