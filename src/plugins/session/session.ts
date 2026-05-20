import { MemorySessionStore } from "./session_store.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { TypedMiddleware } from "../../server/http/typed_middleware.js";
import type { SessionOptions, SessionStore } from "./session_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";

/**
 * Session plugin middleware, used to store the session in the request and response objects
 * Uses cookies to send the session id
 * @warning Must be used after the cookie middleware
 * @param options Session options
 * @param options.name The name of the session cookie
 * @param options.ttl The TTL of the session in seconds
 * @param options.store The store to use for the session
 * @param options.cookie The cookie options
 */
export const session = (
  options?: SessionOptions,
): TypedMiddleware<{
  session: Record<string, any>;
  saveSession: () => Promise<void>;
  destroySession: () => Promise<void>;
  regenerateSession: () => Promise<void>;
}> => {
  const name = options?.name ?? "sid";
  const ttl = options?.ttl ?? 60 * 60 * 24; // 1 day
  const store: SessionStore = options?.store ?? new MemorySessionStore();
  const useSignedCookie = Boolean(options?.secret);
  const cookieDefaults = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax" as const,
    ...(useSignedCookie ? { signed: true as const } : {}),
    ...(options?.cookie ?? {}),
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const sidFromCookie = readSessionIdFromCookies(req, name);
    let sid = sidFromCookie;
    let sess = sid ? await store.get(sid) : undefined;

    if (!sid || !sess) {
      sid ||= nativeCrypto.randomUUID();
      sess ||= {};
      await store.set(sid, sess, ttl);
      res.cookie?.(name, sid, cookieDefaults);
    }

    let destroyed = false;

    req.session = sess;
    req.saveSession = async () => store.set(sid as string, sess, ttl);
    req.destroySession = async () => {
      destroyed = true;
      await store.destroy(sid!);
      res.clearCookie?.(name, cookieDefaults);
    };
    req.regenerateSession = async () => {
      // Invalidate old SID to prevent fixation
      await store.destroy(sid!);
      sid = nativeCrypto.randomUUID();
      // sess reference stays — session data is preserved across regeneration
      await store.set(sid, sess!, ttl);
      res.cookie?.(name, sid, cookieDefaults);
    };

    await next();

    // Skip re-save when session was explicitly destroyed — prevents resurrection
    if (!destroyed) {
      await store.set(sid, sess!, ttl);
    }
  };
};

function readSessionIdFromCookies(
  req: Request,
  name: string,
): string | undefined {
  try {
    const signed = req.signedCookies[name];
    if (signed !== undefined) {
      return signed;
    }
  } catch {
    // signedCookies unavailable when cookie middleware did not run
  }

  try {
    return req.cookies[name];
  } catch {
    return undefined;
  }
}
