import { MemorySessionStore } from "src/plugins/session/session_store";
import type { ServerRouteMiddleware } from "src/runtime/native_server/server_types";
import type { NextFunction } from "src/server/http/next";
import type { Request } from "src/server/http/request";
import type { Response } from "src/server/http/response";
import type { SessionOptions, SessionStore } from "./session_types";
import { nativeCrypto } from "src/runtime/native_crypto";

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
export const session = (options?: SessionOptions): ServerRouteMiddleware => {
  const name = options?.name ?? "sid";
  const ttl = options?.ttl ?? 60 * 60 * 24; // 1 day
  const store: SessionStore = options?.store ?? new MemorySessionStore();
  const cookieDefaults = {
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
    ...(options?.cookie ?? {}),
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const sidFromCookie = req.cookies && req.cookies[name];
    let sid = sidFromCookie;
    let sess = sid ? await store.get(sid) : undefined;

    if (!sid || !sess) {
      sid ||= nativeCrypto.randomUUID();
      sess ||= {};
      await store.set(sid, sess, ttl);
      res.cookie?.(name, sid, cookieDefaults);
    }

    req.session = sess;
    req.saveSession = async () => store.set(sid, sess, ttl);
    req.destroySession = async () => {
      await store.destroy(sid!);
      res.clearCookie?.(name, cookieDefaults);
    };

    await next();
    await store.set(sid, sess, ttl);
  };
};
