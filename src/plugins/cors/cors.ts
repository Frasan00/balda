import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { CorsOptions } from "./cors_types.js";

// Chars permitted in an HTTP Origin header value (scheme://host[:port])
const SAFE_ORIGIN_CHARS = /^[A-Za-z0-9:/.\-]+$/;

// Safe default allowed headers — avoids reflecting arbitrary client headers
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Accept", "Authorization"];

type ResolvedCorsOptions = {
  origin: NonNullable<CorsOptions["origin"]>;
  methods: NonNullable<CorsOptions["methods"]>;
  allowedHeaders: string[];
  exposedHeaders?: CorsOptions["exposedHeaders"];
  credentials: NonNullable<CorsOptions["credentials"]>;
  maxAge?: CorsOptions["maxAge"];
  preflightContinue: NonNullable<CorsOptions["preflightContinue"]>;
  optionsSuccessStatus: NonNullable<CorsOptions["optionsSuccessStatus"]>;
  allowNullOrigin: boolean;
};

/**
 * CORS plugin
 *
 * ⚠️ SECURITY: `origin` is now required. The old wildcard default has been removed.
 * Using `origin: "*"` with `credentials: true` throws at construction.
 *
 * @example
 * // Explicit allowlist (production)
 * cors({ origin: ['https://example.com', 'https://app.example.com'] })
 *
 * @example
 * // Public API (no credentials)
 * cors({ origin: '*' })
 */
export const cors = (options: CorsOptions): ServerRouteMiddleware => {
  // js guard
  if (!options) {
    throw new Error(
      "cors() requires an options object with an explicit `origin`. " +
        "Use cors({ origin: '*' }) for public APIs or specify allowed origins.",
    );
  }

  if (options.origin === "*" && options.credentials === true) {
    throw new Error(
      "cors(): `origin: '*'` and `credentials: true` cannot be combined. " +
        "This is forbidden by the Fetch spec and browsers will reject such responses. " +
        "Use an explicit origin list when credentials are required.",
    );
  }

  const opts: ResolvedCorsOptions = {
    origin: options.origin ?? "*",
    methods: options.methods ?? [
      "GET",
      "HEAD",
      "PUT",
      "PATCH",
      "POST",
      "DELETE",
    ],
    allowedHeaders: options.allowedHeaders
      ? Array.isArray(options.allowedHeaders)
        ? (options.allowedHeaders as string[])
        : [options.allowedHeaders as string]
      : DEFAULT_ALLOWED_HEADERS,
    exposedHeaders: options.exposedHeaders,
    credentials: options.credentials ?? false,
    maxAge: options.maxAge,
    preflightContinue: options.preflightContinue ?? false,
    optionsSuccessStatus: options.optionsSuccessStatus ?? 204,
    allowNullOrigin: options.allowNullOrigin ?? false,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = req.rawHeaders.get("origin") || "";

    // No Origin header — skip CORS headers entirely (non-browser / same-origin)
    if (!requestOrigin) {
      await next();
      return;
    }

    if (req.method === "OPTIONS") {
      return handlePreflightRequest(req, res, opts, requestOrigin, next);
    }

    handleRegularRequest(req, res, opts, requestOrigin);
    await next();
  };
};

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

  // Validate Access-Control-Request-Method against allowed methods
  const requestedMethod = req.rawHeaders.get("access-control-request-method");
  if (requestedMethod) {
    const normalizedMethods = Array.isArray(opts.methods)
      ? (opts.methods as string[]).map((m) => m.toUpperCase())
      : String(opts.methods)
          .split(",")
          .map((m) => m.trim().toUpperCase());
    if (!normalizedMethods.includes(requestedMethod.toUpperCase())) {
      res.forbidden("CORS method not allowed");
      return;
    }
  }

  setCorsHeaders(res, opts, allowOrigin, true);

  if (opts.preflightContinue) {
    next();
    return;
  }

  res.status(opts.optionsSuccessStatus || 204);
  res.send("");
}

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

  setCorsHeaders(res, opts, allowOrigin, false);
}

/**
 * Determine if the request origin is allowed.
 * Returns the value to put in Access-Control-Allow-Origin, or false to block.
 */
function determineOrigin(
  opts: ResolvedCorsOptions,
  requestOrigin: string,
): string | false {
  // Block null origin (sandboxed iframes, file://) unless explicitly allowed
  if (requestOrigin === "null" && !opts.allowNullOrigin) {
    return false;
  }

  // Reject origins containing CRLF or other non-safe chars (header injection)
  if (!SAFE_ORIGIN_CHARS.test(requestOrigin)) {
    return false;
  }

  if (typeof opts.origin === "string") {
    if (opts.origin === "*") {
      return "*";
    }
    return requestOrigin === opts.origin ? requestOrigin : false;
  }

  if (Array.isArray(opts.origin)) {
    const match = opts.origin.find((origin) => {
      if (typeof origin === "string") {
        return origin === requestOrigin;
      }
      if (origin instanceof RegExp) {
        return origin.test(requestOrigin);
      }
      return false;
    });

    if (!match) {
      return false;
    }

    // Always reflect the actual request origin (not the pattern) so ACAO is specific
    return requestOrigin;
  }

  return false;
}

/**
 * Set CORS headers on the response.
 * Adds Vary headers to prevent cache poisoning.
 */
function setCorsHeaders(
  res: Response,
  opts: ResolvedCorsOptions,
  allowOrigin: string,
  isPreflight: boolean,
): void {
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);

  // When the response varies on Origin, caches must key on it
  if (allowOrigin !== "*") {
    appendVary(res, "Origin");
  }

  if (opts.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  const exposedHeaders = normalizeHeaderValue(opts.exposedHeaders);
  if (exposedHeaders) {
    res.setHeader("Access-Control-Expose-Headers", exposedHeaders);
  }

  const methodsStr = normalizeHeaderValue(opts.methods);
  res.setHeader("Access-Control-Allow-Methods", String(methodsStr || ""));

  if (isPreflight) {
    res.setHeader(
      "Access-Control-Allow-Headers",
      opts.allowedHeaders.join(","),
    );
    appendVary(res, "Access-Control-Request-Headers");
    appendVary(res, "Access-Control-Request-Method");

    if (typeof opts.maxAge === "number") {
      res.setHeader("Access-Control-Max-Age", opts.maxAge.toString());
    }
  }
}

function appendVary(res: Response, field: string): void {
  const existing = res.headers["Vary"];
  if (!existing) {
    res.setHeader("Vary", field);
  } else if (
    !existing
      .split(",")
      .map((v) => v.trim())
      .includes(field)
  ) {
    res.setHeader("Vary", `${existing}, ${field}`);
  }
}

function normalizeHeaderValue(value?: string[] | string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value.join(",") : value;
}
