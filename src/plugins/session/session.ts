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
    const storedSession = sid ? await store.get(sid) : undefined;

    // Create new session if none exists or expired
    if (!sid || !storedSession) {
      sid = nativeCrypto.randomUUID();
      const newSession = {};
      await store.set(sid, newSession, ttl);
      res.cookie?.(name, sid, cookieDefaults);

      // Clone for request isolation
      req.session = { ...newSession };
      // Session is new, mark as dirty for save
      req._sessionDirty = true;
      req._sessionId = sid;
      req._sessionTtl = ttl;
      req._sessionStore = store;
      req._sessionCookieName = name;
      req._sessionCookieDefaults = cookieDefaults;
    } else {
      // Clone existing session for request isolation
      req.session = { ...storedSession };
      req._sessionDirty = false; // Mark as clean initially
      req._sessionId = sid;
      req._sessionTtl = ttl;
      req._sessionStore = store;
      req._sessionCookieName = name;
      req._sessionCookieDefaults = cookieDefaults;
    }

    let destroyed = false;

    // Use cloned session reference with proper null checks
    req.saveSession = async () => {
      if (!req._sessionId || !req._sessionStore) {
        throw new Error(
          "Cannot save session: no session ID or store available",
        );
      }
      if (!req.session) {
        throw new Error("Cannot save session: session data is undefined");
      }
      await req._sessionStore.set(req._sessionId, req.session, req._sessionTtl);
      req._sessionDirty = false; // Mark as clean after save
    };

    req.destroySession = async () => {
      if (!req._sessionId || !req._sessionStore) {
        throw new Error(
          "Cannot destroy session: no session ID or store available",
        );
      }
      destroyed = true;
      await req._sessionStore.destroy(req._sessionId);
      res.clearCookie?.(
        req._sessionCookieName ?? "sid",
        req._sessionCookieDefaults,
      );
      req._sessionDirty = false; // No need to save destroyed session
    };

    req.regenerateSession = async () => {
      if (!req._sessionId || !req._sessionStore) {
        throw new Error(
          "Cannot regenerate session: no session ID or store available",
        );
      }
      if (!req.session) {
        throw new Error("Cannot regenerate session: session data is undefined");
      }
      // Invalidate old SID to prevent fixation
      await req._sessionStore.destroy(req._sessionId);
      const newSid = nativeCrypto.randomUUID();
      // Preserve session data across regeneration
      await req._sessionStore.set(newSid, req.session, req._sessionTtl);
      res.cookie?.(
        req._sessionCookieName ?? "sid",
        newSid,
        req._sessionCookieDefaults,
      );
      req._sessionId = newSid;
      req._sessionDirty = true; // Mark as dirty since we updated the store
    };

    await next();

    // Skip re-save when session was explicitly destroyed — prevents resurrection
    // Only save if session was modified (dirty tracking)
    if (
      !destroyed &&
      req._sessionDirty &&
      req._sessionId &&
      req._sessionStore &&
      req.session
    ) {
      await req._sessionStore.set(req._sessionId, req.session, req._sessionTtl);
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
