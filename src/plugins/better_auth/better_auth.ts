import type { Auth } from "better-auth";
import { canHaveBody } from "../../runtime/native_server/server_utils.js";
import type {
  HttpMethod,
  ServerRouteHandler,
} from "../../runtime/native_server/server_types.js";
import type { Request as BaldaRequest } from "../../server/http/request.js";
import type { Response as BaldaResponse } from "../../server/http/response.js";
import { router } from "../../server/router/router.js";
import type { BetterAuthMountOptions } from "./better_auth_types.js";

const ALL_HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

/**
 * Builds the Web API Request better-auth expects out of a Balda request.
 *
 * Two things Balda's own `req.toWebApi()` cannot give us here:
 * - `req.url` reflects the server's bind address (e.g. `http://0.0.0.0:3000/...`),
 *   not the client-facing host, so better-auth's origin/CSRF checks would see
 *   the wrong origin. The URL is rebuilt from the `Host` / `X-Forwarded-Host`
 *   headers instead.
 * - If the `bodyParser` plugin already ran, it consumed the underlying stream
 *   and cached the drained Request on `req` — a second `req.toWebApi()` would
 *   throw `Body is unusable`. The already-parsed `req.body` is re-serialized
 *   instead of touching that cached Request.
 */
const toWebRequest = (req: BaldaRequest): globalThis.Request => {
  const url = new URL(req.url);
  // X-Forwarded-Host/-Proto are trusted unconditionally, with no allowlist —
  // matching better-auth's own default (`advanced.trustedProxyHeaders` is
  // true unless set otherwise). This is only safe when a real reverse proxy
  // in front of the app strips client-supplied X-Forwarded-* headers before
  // setting its own; if the app is reachable directly, a forged
  // X-Forwarded-Host can influence origin resolution and generated URLs
  // (password reset links, OAuth callbacks). Set `baseURL` explicitly in
  // production so those don't depend on it either way — see the docs.
  const host =
    req.rawHeaders.get("x-forwarded-host") ?? req.rawHeaders.get("host");
  if (host) {
    // `url.host = host` alone keeps the old port when `host` has none of its
    // own (e.g. rewriting from "0.0.0.0:3000" to "app.example.com" would
    // otherwise leave ":3000" attached) — clear it first.
    url.port = "";
    url.host = host;
  }
  const proto = req.rawHeaders.get("x-forwarded-proto");
  if (proto) url.protocol = `${proto}:`;

  const headers = new Headers(req.rawHeaders);

  if (!canHaveBody(req.method)) {
    return new globalThis.Request(url, { method: req.method, headers });
  }

  if (req.body !== undefined) {
    // bodyParser's fallback (no json/urlencoded/fileParser option matched
    // the content type) leaves req.body as a raw ArrayBuffer/Uint8Array —
    // JSON.stringify() on those silently produces "{}", so pass them
    // through as-is rather than re-encoding.
    const body =
      typeof req.body === "string" ||
      req.body instanceof ArrayBuffer ||
      req.body instanceof Uint8Array
        ? (req.body as BodyInit)
        : JSON.stringify(req.body);
    headers.delete("content-length");
    return new globalThis.Request(url, { method: req.method, headers, body });
  }

  // bodyParser hasn't run: forward the still-unread request stream.
  const webReq = req.toWebApi();
  const init: RequestInit = { method: req.method, headers };
  if (webReq.body) {
    init.body = webReq.body;
    (init as { duplex?: "half" }).duplex = "half";
  }
  return new globalThis.Request(url, init);
};

/**
 * Copies a better-auth Web API Response onto the Balda response, preserving
 * every `Set-Cookie` header — Balda accumulates them separately so each is
 * emitted as its own header (RFC 6265 §3), unlike naively copying a `Headers`
 * object which only keeps the last one.
 *
 * Header names land lowercased in `res.headers` — the Web `Headers` iterator
 * always yields lowercase names, and HTTP header names are case-insensitive
 * on the wire, so this has no effect on the actual response.
 */
const writeWebResponse = async (
  webRes: globalThis.Response,
  res: BaldaResponse,
): Promise<void> => {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
  });
  for (const cookie of webRes.headers.getSetCookie()) {
    res.setHeader("Set-Cookie", cookie);
  }

  const buffer = await webRes.arrayBuffer();
  res.raw(buffer.byteLength ? new Uint8Array(buffer) : "");
};

/**
 * Converts a better-auth instance into a Balda route handler.
 * @param auth - A configured better-auth instance (`betterAuth({...})`).
 * @example
 * ```ts
 * import { betterAuthHandler, router } from "balda";
 * import { auth } from "./auth.js";
 *
 * router.get("/api/auth/*", betterAuthHandler(auth));
 * router.post("/api/auth/*", betterAuthHandler(auth));
 * ```
 */
export const betterAuthHandler = (auth: Auth<any>): ServerRouteHandler => {
  return async (req: BaldaRequest, res: BaldaResponse) => {
    const webReq = toWebRequest(req);
    const webRes = await auth.handler(webReq);
    await writeWebResponse(webRes, res);
  };
};

/**
 * Mounts every better-auth route on the Balda router in one call.
 * @param auth - A configured better-auth instance (`betterAuth({...})`).
 * @param options.basePath - Overrides the mount path. Defaults to
 * `auth.options.basePath ?? "/api/auth"`.
 * @example
 * ```ts
 * import { Server, mountBetterAuth } from "balda";
 * import { auth } from "./auth.js";
 *
 * mountBetterAuth(auth);
 *
 * const server = new Server();
 * server.listen(3000);
 * ```
 */
export const mountBetterAuth = (
  auth: Auth<any>,
  options?: BetterAuthMountOptions,
): void => {
  const basePath = options?.basePath ?? auth.options?.basePath ?? "/api/auth";
  const wildcardPath = `${basePath}/*`;
  const handler = betterAuthHandler(auth);

  for (const method of ALL_HTTP_METHODS) {
    router.addOrUpdate(
      method,
      wildcardPath,
      [],
      handler,
      {},
      { excludeFromSwagger: true },
      undefined,
      // Allow re-registration: calling mountBetterAuth again (hot reload, a
      // bootstrap path that runs twice, a new `auth` instance) replaces the
      // previous handler instead of throwing "Duplicate route detected".
      true,
    );
  }
};
