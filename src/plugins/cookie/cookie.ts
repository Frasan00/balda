import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { TypedMiddleware } from "../../server/http/typed_middleware.js";
import type { CookieMiddlewareOptions, CookieOptions } from "./cookie_types.js";

// RFC 6265 cookie-name token chars: US-ASCII visible chars except delimiters
const COOKIE_NAME_RE = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
// Safe attribute value chars: printable ASCII except ; and \r\n
const SAFE_ATTR_RE = /^[\x20-\x7E]*$/;
const ATTR_FORBIDDEN = /[;\r\n]/;
// Names that, if decoded, would alter Object prototype
const RESERVED_NAMES = new Set(["__proto__", "prototype", "constructor"]);
// Hard limits to prevent DoS
const MAX_COOKIE_HEADER_BYTES = 8192;
const MAX_COOKIE_PAIRS = 50;

/**
 * Cookie middleware for parsing and setting cookies.
 * Must be used before any handler that accesses `req.cookies` or `req.signedCookies`.
 */
export const cookie = (
  options?: CookieMiddlewareOptions,
): TypedMiddleware<{
  cookies: Record<string, string>;
  signedCookies: Record<string, string>;
}> => {
  const secrets = normalizeSecrets(options?.secret);

  if (options?.sign && secrets.length === 0) {
    throw new Error(
      "Cookie signing requires a secret. Set `secret` when `sign` is enabled.",
    );
  }

  const globalSign = options?.sign ?? false;
  const defaults: CookieOptions = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    ...options?.defaults,
  };
  const shouldParse = options?.parse ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    req.cookies = Object.create(null) as Record<string, string>;
    req.signedCookies = Object.create(null) as Record<string, string>;

    if (shouldParse) {
      const rawCookies = parseCookies(req.rawHeaders.get("cookie") || "");

      for (const [name, value] of Object.entries(rawCookies)) {
        if (globalSign && secrets.length > 0) {
          const verified = verifySignedCookie(value, secrets);
          if (verified !== false) {
            req.signedCookies[name] = verified;
          }
          // Do not expose signed cookies in req.cookies to prevent downgrade confusion
          continue;
        }
        req.cookies[name] = value;
      }
    }

    res.cookie = (
      name: string,
      value: string,
      cookieOptions?: CookieOptions,
    ) => {
      const merged: CookieOptions = { ...defaults, ...cookieOptions };
      // Per-cookie signed override: respect if explicitly set
      const shouldSign =
        cookieOptions?.signed !== undefined ? cookieOptions.signed : globalSign;
      setCookie(res, name, value, merged, shouldSign, secrets);
    };

    res.clearCookie = (name: string, cookieOptions?: CookieOptions) => {
      const merged: CookieOptions = {
        ...defaults,
        ...cookieOptions,
        maxAge: 0,
        expires: new Date(0),
      };
      setCookie(res, name, "", merged, false, []);
    };

    await next();
  };
};

function normalizeSecrets(secret?: string | string[]): string[] {
  if (!secret) return [];
  return Array.isArray(secret) ? secret.filter(Boolean) : [secret];
}

/**
 * Parse Cookie header into a null-prototype object.
 * Enforces size/count limits and drops malformed or reserved-name pairs.
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies = Object.create(null) as Record<string, string>;

  if (!cookieString) {
    return cookies;
  }

  // Hard cap on total header size to prevent DoS
  const input = cookieString.slice(0, MAX_COOKIE_HEADER_BYTES);
  const pairs = input.split(";");
  let count = 0;

  for (const pair of pairs) {
    if (count >= MAX_COOKIE_PAIRS) break;

    const trimmed = pair.trim();
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(trimmed.slice(0, separatorIndex));
      value = decodeURIComponent(trimmed.slice(separatorIndex + 1));
    } catch {
      // Malformed percent-encoding — skip pair instead of throwing 500
      continue;
    }

    if (RESERVED_NAMES.has(name)) continue;

    cookies[name] = value;
    count++;
  }

  return cookies;
}

function validateAttrString(label: string, value: string): void {
  if (!SAFE_ATTR_RE.test(value) || ATTR_FORBIDDEN.test(value)) {
    throw new Error(
      `Cookie ${label} contains invalid characters (CR, LF, or semicolons are not permitted): ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Build and append a Set-Cookie header string to the response.
 */
function setCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions,
  shouldSign: boolean,
  secrets: string[],
): void {
  if (!COOKIE_NAME_RE.test(name)) {
    throw new Error(
      `Invalid cookie name ${JSON.stringify(name)}: must be a valid RFC 6265 token.`,
    );
  }

  if (options.sameSite === "None" && !options.secure) {
    throw new Error(
      `Cookie ${JSON.stringify(name)}: sameSite "None" requires secure: true.`,
    );
  }

  const rawValue =
    shouldSign && secrets.length > 0 ? signCookie(value, secrets[0]) : value;

  let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(rawValue)}`;

  if (options.domain) {
    validateAttrString("domain", options.domain);
    cookieStr += `; Domain=${options.domain}`;
  }

  if (options.path) {
    validateAttrString("path", options.path);
    cookieStr += `; Path=${options.path}`;
  }

  if (options.expires !== undefined) {
    if (Number.isNaN(options.expires.getTime())) {
      throw new Error(
        `Cookie ${JSON.stringify(name)}: expires is an Invalid Date.`,
      );
    }
    cookieStr += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.maxAge !== undefined) {
    if (!Number.isInteger(options.maxAge) || options.maxAge < 0) {
      throw new Error(
        `Cookie ${JSON.stringify(name)}: maxAge must be a non-negative integer, got ${options.maxAge}.`,
      );
    }
    cookieStr += `; Max-Age=${options.maxAge}`;
  }

  if (options.secure) {
    cookieStr += "; Secure";
  }

  if (options.httpOnly) {
    cookieStr += "; HttpOnly";
  }

  if (options.sameSite) {
    // sameSite is a known enum; no need to re-validate chars
    cookieStr += `; SameSite=${options.sameSite}`;
  }

  if (options.priority) {
    if (!["Low", "Medium", "High"].includes(options.priority)) {
      throw new Error(
        `Cookie ${JSON.stringify(name)}: priority must be "Low", "Medium", or "High".`,
      );
    }
    cookieStr += `; Priority=${options.priority}`;
  }

  // Push to array — response.ts accumulates these as separate Set-Cookie headers
  res.setHeader("Set-Cookie", cookieStr);
}

function signCookie(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${signature}`;
}

/**
 * Verify a signed cookie against any of the provided secrets (key rotation).
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifySignedCookie(value: string, secrets: string[]): string | false {
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return false;
  }

  const cookieValue = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const providedBuffer = Buffer.from(signature, "hex");

  for (const secret of secrets) {
    const expectedSignature = createHmac("sha256", secret)
      .update(cookieValue)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return cookieValue;
    }
  }

  return false;
}
