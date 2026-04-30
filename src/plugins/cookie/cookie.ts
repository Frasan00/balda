import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { TypedMiddleware } from "../../server/http/typed_middleware.js";
import type { CookieMiddlewareOptions, CookieOptions } from "./cookie_types.js";

/**
 * Cookie middleware for parsing and setting cookies, must be used in order to use the cookie methods on the request and response objects
 *
 * @param options Cookie middleware options
 */
export const cookie = (
  options?: CookieMiddlewareOptions,
): TypedMiddleware<{ cookies: Record<string, string> }> => {
  if (options?.sign && !options.secret) {
    throw new Error(
      "Cookie signing requires a secret. Set `secret` when `sign` is enabled.",
    );
  }

  const opts: Required<CookieMiddlewareOptions> = {
    secret: options?.secret ?? "",
    defaults: {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      ...options?.defaults,
    },
    parse: options?.parse ?? true,
    sign: options?.sign ?? false,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (opts.parse) {
      const rawCookies = parseCookies(req.rawHeaders.get("cookie") || "");
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

  if (!cookieString) {
    return cookies;
  }

  const pairs = cookieString.split(";");

  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    const separatorIndex = trimmedPair.indexOf("=");

    if (separatorIndex > 0) {
      const name = trimmedPair.slice(0, separatorIndex);
      const value = trimmedPair.slice(separatorIndex + 1);
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
  const signedValue =
    middlewareOptions.sign && middlewareOptions.secret
      ? signCookie(value, middlewareOptions.secret)
      : value;
  let cookieValue = `${encodeURIComponent(name)}=${encodeURIComponent(signedValue)}`;

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

  // Set the Set-Cookie header
  const existingCookies = res.headers["Set-Cookie"] || "";
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
 * Sign a cookie value with HMAC-SHA256 using the secret
 */
function signCookie(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${signature}`;
}

/**
 * Verify a signed cookie
 */
function verifySignedCookie(value: string, secret: string): string | false {
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return false;
  }

  const cookieValue = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", secret)
    .update(cookieValue)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  return cookieValue;
}
