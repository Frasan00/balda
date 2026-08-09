import type { Auth } from "better-auth";
import { describe, expect, it } from "vitest";
import { betterAuthHandler } from "../../../src/plugins/better_auth/better_auth.js";
import { Request } from "../../../src/server/http/request.js";
import { Response as BaldaResponse } from "../../../src/server/http/response.js";

/**
 * Builds a real Balda Request from a real Web API Request, exactly like the
 * mock server / Bun / Deno runtimes do (`Request.fromRequest`), so `req.toWebApi()`
 * exercises its actual cached-request behaviour instead of a stubbed one.
 */
const makeRequest = (init: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
}): Request => {
  const webReq = new globalThis.Request(init.url, {
    method: init.method ?? "GET",
    headers: init.headers,
    ...(init.body !== undefined
      ? { body: init.body, duplex: "half" as const }
      : {}),
  } as RequestInit);
  return Request.fromRequest(webReq);
};

/** Stub better-auth instance: captures the Request it receives, returns a canned Web Response. */
const makeAuth = (
  respond: (
    req: globalThis.Request,
  ) => globalThis.Response | Promise<globalThis.Response>,
  basePath = "/api/auth",
): { auth: Auth; captured: () => globalThis.Request } => {
  let captured!: globalThis.Request;
  const auth = {
    options: { basePath },
    handler: async (req: globalThis.Request) => {
      captured = req;
      return respond(req);
    },
  } as unknown as Auth;
  return { auth, captured: () => captured };
};

describe("betterAuthHandler - request forwarding", () => {
  it("rebuilds the URL from the Host header, not the bind address", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/session",
      headers: { host: "app.example.com" },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    expect(captured().url).toBe("http://app.example.com/api/auth/session");
  });

  it("prefers x-forwarded-host and x-forwarded-proto over Host", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/session",
      headers: {
        host: "internal.local",
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    expect(captured().url).toBe("https://app.example.com/api/auth/session");
  });

  it("keeps the path and query string intact (OAuth callbacks are query-driven)", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/callback/github?code=abc&state=xyz",
      headers: { host: "app.example.com" },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    const url = new URL(captured().url);
    expect(url.pathname).toBe("/api/auth/callback/github");
    expect(url.searchParams.get("code")).toBe("abc");
    expect(url.searchParams.get("state")).toBe("xyz");
  });

  it("does not mutate the original request's headers or url", async () => {
    const { auth } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/session",
      headers: { host: "app.example.com" },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    expect(req.url).toBe("http://0.0.0.0:3000/api/auth/session");
    expect(req.rawHeaders.get("host")).toBe("app.example.com");
  });

  it("forwards cookie and authorization headers untouched", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/session",
      headers: {
        host: "app.example.com",
        cookie: "better-auth.session_token=abc123",
        authorization: "Bearer xyz",
      },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    expect(captured().headers.get("cookie")).toBe(
      "better-auth.session_token=abc123",
    );
    expect(captured().headers.get("authorization")).toBe("Bearer xyz");
  });

  it("forwards the live request stream when the body hasn't been parsed yet", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/sign-in/email",
      method: "POST",
      headers: { host: "app.example.com", "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    await expect(captured().json()).resolves.toEqual({ email: "a@b.com" });
  });

  it("re-serializes an already-parsed body instead of touching the drained request", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/sign-in/email",
      method: "POST",
      headers: {
        host: "app.example.com",
        "content-type": "application/json",
        "content-length": "9999",
      },
    });
    // Simulate bodyParser having already consumed the stream and parsed it.
    req.body = { email: "a@b.com" };

    await betterAuthHandler(auth)(req, new BaldaResponse());

    await expect(captured().json()).resolves.toEqual({ email: "a@b.com" });
    expect(captured().headers.get("content-length")).toBeNull();
  });

  it("passes a string body through unchanged", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/sign-in/email",
      method: "POST",
      headers: { host: "app.example.com" },
    });
    req.body = "raw-string-body";

    await betterAuthHandler(auth)(req, new BaldaResponse());

    await expect(captured().text()).resolves.toBe("raw-string-body");
  });

  it('passes an already-parsed binary body through as bytes, not JSON.stringify("{}")', async () => {
    // bodyParser's generic fallback (no json/urlencoded/fileParser option
    // matched the content type) leaves req.body as a raw ArrayBuffer.
    // JSON.stringify(new ArrayBuffer()) silently produces "{}" — this must
    // not happen.
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/sign-in/email",
      method: "POST",
      headers: { host: "app.example.com" },
    });
    const bytes = new TextEncoder().encode(
      JSON.stringify({ email: "a@b.com" }),
    );
    req.body = bytes.buffer;

    await betterAuthHandler(auth)(req, new BaldaResponse());

    await expect(captured().json()).resolves.toEqual({ email: "a@b.com" });
  });

  it("sends no body for GET/HEAD and does not throw", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const req = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/session",
      method: "GET",
      headers: { host: "app.example.com" },
    });

    await betterAuthHandler(auth)(req, new BaldaResponse());

    expect(captured().body).toBeNull();
  });

  it("handles two independent requests without any cached-request bleed", async () => {
    const { auth, captured } = makeAuth(() => new globalThis.Response("ok"));
    const handler = betterAuthHandler(auth);

    const reqA = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/a",
      headers: { host: "a.example.com" },
    });
    const reqB = makeRequest({
      url: "http://0.0.0.0:3000/api/auth/b",
      headers: { host: "b.example.com" },
    });

    await handler(reqA, new BaldaResponse());
    expect(captured().url).toBe("http://a.example.com/api/auth/a");

    await handler(reqB, new BaldaResponse());
    expect(captured().url).toBe("http://b.example.com/api/auth/b");
  });
});

describe("betterAuthHandler - response forwarding", () => {
  it("forwards status codes", async () => {
    for (const status of [200, 302, 401, 404]) {
      const { auth } = makeAuth(
        () => new globalThis.Response(null, { status }),
      );
      const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/x" });
      const res = new BaldaResponse();

      await betterAuthHandler(auth)(req, res);

      expect(res.responseStatus).toBe(status);
    }
  });

  it("keeps every Set-Cookie header separate — not collapsed into one", async () => {
    const webRes = new globalThis.Response(null, { status: 200 });
    webRes.headers.append("Set-Cookie", "session=abc; Path=/; HttpOnly");
    webRes.headers.append("Set-Cookie", "csrf=def; Path=/");
    const { auth } = makeAuth(() => webRes);

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/sign-in" });
    const res = new BaldaResponse();

    await betterAuthHandler(auth)(req, res);

    expect(res.cookieHeaders).toEqual([
      "session=abc; Path=/; HttpOnly",
      "csrf=def; Path=/",
    ]);
  });

  it("preserves Content-Type instead of forcing text/plain", async () => {
    const webRes = new globalThis.Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const { auth } = makeAuth(() => webRes);

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/x" });
    const res = new BaldaResponse();

    await betterAuthHandler(auth)(req, res);

    // Forwarded header names land lowercase — Web Headers.forEach always
    // yields lowercase names, and HTTP headers are case-insensitive on the wire.
    expect(res.headers["content-type"]).toBe("application/json");
    const decoded = new TextDecoder().decode(res.getBody());
    expect(JSON.parse(decoded)).toEqual({ ok: true });
  });

  it("forwards the Location header on a redirect", async () => {
    const webRes = new globalThis.Response(null, {
      status: 302,
      headers: { Location: "https://app.example.com/dashboard" },
    });
    const { auth } = makeAuth(() => webRes);

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/callback" });
    const res = new BaldaResponse();

    await betterAuthHandler(auth)(req, res);

    expect(res.responseStatus).toBe(302);
    expect(res.headers["location"]).toBe("https://app.example.com/dashboard");
  });

  it("handles an empty body without throwing", async () => {
    const { auth } = makeAuth(
      () => new globalThis.Response(null, { status: 204 }),
    );

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/sign-out" });
    const res = new BaldaResponse();

    await betterAuthHandler(auth)(req, res);

    expect(res.responseStatus).toBe(204);
    expect(res.getBody()).toBe("");
  });

  it("forwards a binary body byte-for-byte", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const webRes = new globalThis.Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
    const { auth } = makeAuth(() => webRes);

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/x" });
    const res = new BaldaResponse();

    await betterAuthHandler(auth)(req, res);

    expect(new Uint8Array(res.getBody())).toEqual(bytes);
  });

  it("propagates a rejecting auth.handler instead of swallowing it", async () => {
    const auth = {
      options: { basePath: "/api/auth" },
      handler: async () => {
        throw new Error("boom");
      },
    } as unknown as Auth;

    const req = makeRequest({ url: "http://0.0.0.0:3000/api/auth/x" });
    const res = new BaldaResponse();

    await expect(betterAuthHandler(auth)(req, res)).rejects.toThrow("boom");
  });
});
