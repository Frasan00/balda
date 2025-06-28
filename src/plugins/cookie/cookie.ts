import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import type { CookieMiddlewareOptions, CookieOptions } from "./cookie_types";

/**
 * Cookie middleware for parsing and setting cookies, must be used in order to use the cookie methods on the request and response objects
 * @param options Cookie middleware options
 */
export const cookie = (
  options?: CookieMiddlewareOptions,
): ServerRouteMiddleware => {
  const opts: Required<CookieMiddlewareOptions> = {
    secret: options?.secret ?? "",
    defaults: {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      ...options?.defaults,
    },
    parse: options?.parse ?? true,
    sign: options?.sign ?? false,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (opts.parse) {
      const rawCookies = parseCookies(req.headers.get("cookie") || "");
      req.cookies = {};

      for (const [name, value] of Object.entries(rawCookies)) {
        if (opts.sign && opts.secret) {
          const verified = verifySignedCookie(value, opts.secret);
          if (verified !== false) {
            req.cookies[name] = verified;
          }
          continue;
        }

        req.cookies[name] = value;
      }
    }

    // Add cookie methods to response
    res.cookie = (
      name: string,
      value: string,
      cookieOptions?: CookieOptions,
    ) => {
      setCookie(res, name, value, { ...opts.defaults, ...cookieOptions }, opts);
    };

    res.clearCookie = (name: string, cookieOptions?: CookieOptions) => {
      clearCookie(res, name, { ...opts.defaults, ...cookieOptions });
    };

    await next();
  };
};

/**
 * Parse cookie string into an object
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieString) return cookies;

  const pairs = cookieString.split(";");

  for (const pair of pairs) {
    const [name, value] = pair.trim().split("=");
    if (name && value) {
      cookies[decodeURIComponent(name)] = decodeURIComponent(value);
    }
  }

  return cookies;
}

/**
 * Set a cookie on the response
 */
function setCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions,
  middlewareOptions: Required<CookieMiddlewareOptions>,
): void {
  let cookieValue = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  // Add domain
  if (options.domain) {
    cookieValue += `; Domain=${options.domain}`;
  }

  // Add path
  if (options.path) {
    cookieValue += `; Path=${options.path}`;
  }

  // Add expires
  if (options.expires) {
    cookieValue += `; Expires=${options.expires.toUTCString()}`;
  }

  // Add maxAge
  if (options.maxAge) {
    cookieValue += `; Max-Age=${options.maxAge}`;
  }

  // Add secure
  if (options.secure) {
    cookieValue += "; Secure";
  }

  // Add httpOnly
  if (options.httpOnly) {
    cookieValue += "; HttpOnly";
  }

  // Add sameSite
  if (options.sameSite) {
    cookieValue += `; SameSite=${options.sameSite}`;
  }

  // Add priority
  if (options.priority) {
    cookieValue += `; Priority=${options.priority}`;
  }

  // Sign cookie if enabled
  if (middlewareOptions.sign && middlewareOptions.secret) {
    cookieValue = signCookie(cookieValue, middlewareOptions.secret);
  }

  // Set the Set-Cookie header
  const existingCookies = res.headers["set-cookie"] || "";
  const newCookies = existingCookies
    ? `${existingCookies}, ${cookieValue}`
    : cookieValue;
  res.setHeader("Set-Cookie", newCookies);
}

/**
 * Clear a cookie by setting it to expire in the past
 */
function clearCookie(
  res: Response,
  name: string,
  options: CookieOptions,
): void {
  const clearOptions: CookieOptions = {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  };

  setCookie(res, name, "", clearOptions, {
    secret: "",
    defaults: {},
    parse: true,
    sign: false,
  });
}

/**
 * Simple cookie signing (in production, use a proper crypto library)
 */
function signCookie(value: string, secret: string): string {
  // This is a simple hash implementation
  // In production, you should use a proper crypto library like crypto-js or Node.js crypto
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const signature = Math.abs(hash).toString(36);
  return `${value}.${signature}`;
}

/**
 * Verify a signed cookie
 */
function verifySignedCookie(value: string, secret: string): string | false {
  const parts = value.split(".");
  if (parts.length !== 2) return false;

  const [cookieValue, signature] = parts;
  const expectedSignature = signCookie(cookieValue, secret).split(".")[1];

  return signature === expectedSignature ? cookieValue : false;
}
