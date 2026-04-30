import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { CorsOptions } from "./cors_types.js";

type ResolvedCorsOptions = {
  origin: NonNullable<CorsOptions["origin"]>;
  methods: NonNullable<CorsOptions["methods"]>;
  allowedHeaders?: CorsOptions["allowedHeaders"];
  exposedHeaders?: CorsOptions["exposedHeaders"];
  credentials: NonNullable<CorsOptions["credentials"]>;
  maxAge?: CorsOptions["maxAge"];
  preflightContinue: NonNullable<CorsOptions["preflightContinue"]>;
  optionsSuccessStatus: NonNullable<CorsOptions["optionsSuccessStatus"]>;
};

/**
 * CORS plugin
 *
 * ⚠️ SECURITY WARNING: By default, this plugin allows ALL origins ('*').
 * For production environments, explicitly configure allowed origins.
 *
 * @param options CORS options (all optional). Omitted options keep Balda's defaults,
 * including default methods and echoing `Access-Control-Request-Headers` on preflight
 * requests unless `allowedHeaders` is explicitly overridden.
 *
 * @example
 * // Development (permissive)
 * cors()
 *
 * @example
 * // Production (secure)
 * cors({
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   credentials: true
 * })
 */
export const cors = (options?: CorsOptions): ServerRouteMiddleware => {
  const opts: ResolvedCorsOptions = {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    credentials: false,
    maxAge: undefined,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = req.rawHeaders.get("origin") || "";

    if (req.method === "OPTIONS") {
      return handlePreflightRequest(req, res, opts, requestOrigin, next);
    }

    handleRegularRequest(req, res, opts, requestOrigin);
    await next();
  };
};

/**
 * Handle CORS preflight OPTIONS requests
 */
function handlePreflightRequest(
  req: Request,
  res: Response,
  opts: ResolvedCorsOptions,
  requestOrigin: string,
  next: NextFunction,
): void {
  const allowOrigin = determineOrigin(opts, requestOrigin);
  if (!allowOrigin) {
    res.forbidden("CORS origin not allowed");
    return;
  }

  // Set CORS headers for preflight
  setCorsHeaders(
    res,
    opts,
    allowOrigin,
    req.rawHeaders.get("access-control-request-headers") || undefined,
  );

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
  opts: ResolvedCorsOptions,
  requestOrigin: string,
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
  opts: ResolvedCorsOptions,
  requestOrigin: string,
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
        : origin instanceof RegExp && origin.test(requestOrigin),
    );

    if (!matchedOrigin) {
      return false;
    }

    return typeof matchedOrigin === "string" ? matchedOrigin : requestOrigin;
  }

  return "*";
}

/**
 * Set all CORS headers on the response
 */
function setCorsHeaders(
  res: Response,
  opts: ResolvedCorsOptions,
  allowOrigin: string,
  requestAllowedHeaders?: string,
): void {
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);

  if (opts.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  const exposedHeaders = normalizeHeaderValue(opts.exposedHeaders);
  if (exposedHeaders) {
    res.setHeader("Access-Control-Expose-Headers", exposedHeaders);
  }

  const allowedHeaders =
    opts.allowedHeaders === undefined
      ? requestAllowedHeaders
      : normalizeHeaderValue(opts.allowedHeaders);
  if (allowedHeaders) {
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
  }

  const methodsStr = normalizeHeaderValue(opts.methods);
  res.setHeader("Access-Control-Allow-Methods", String(methodsStr || ""));

  if (typeof opts.maxAge === "number") {
    res.setHeader("Access-Control-Max-Age", opts.maxAge.toString());
  }
}

function normalizeHeaderValue(value?: string[] | string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value.join(",") : value;
}
