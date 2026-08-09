import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MockResponse } from "../../../src/mock/mock_response.js";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * Like sendResetPassword/sendVerificationEmail elsewhere in this suite,
 * `sendMagicLink` is a synchronous in-process callback — capturing the
 * token it's called with IS the integration point that matters here, same
 * as those two. Real email delivery is entirely better-auth's concern, not
 * the adapter's.
 */
describe("betterAuthHandler - magicLink plugin", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const HOST = { host: "app.example.com" };
  const SECRET = "test-secret-at-least-32-characters-long";

  const setup = () => {
    let captured: { email: string; token: string; url: string } | null = null;
    const auth: Auth<any> = betterAuth({
      baseURL: "http://app.example.com",
      secret: SECRET,
      emailAndPassword: { enabled: true },
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, token, url }) => {
            captured = { email, token, url };
          },
        }),
      ],
    });
    mountBetterAuth(auth);
    const server = new Server();
    return { auth, server, getCaptured: () => captured };
  };

  const cookieHeader = (res: MockResponse): string =>
    res
      .rawCookieHeaders()
      .map((c) => c.split(";")[0])
      .join("; ");

  it("signs a new user up and in via a magic link, with no password ever set", async () => {
    const { server, getCaptured } = setup();

    const request = await server.inject.post("/api/auth/sign-in/magic-link", {
      body: { email: "magic@example.com", name: "Magic User" },
      headers: HOST,
    });
    expect(request.statusCode()).toBe(200);

    const captured = getCaptured();
    expect(captured?.email).toBe("magic@example.com");
    expect(captured?.token).toBeTruthy();
    expect(captured?.url).toContain(captured!.token);

    const verify = await server.inject.get("/api/auth/magic-link/verify", {
      headers: HOST,
      query: { token: captured!.token },
    });
    expect(verify.statusCode()).toBe(200);
    expect(verify.body()?.user?.email).toBe("magic@example.com");
    // magic-link sign-up verifies the email as a side effect — no separate
    // verify-email round trip needed.
    expect(verify.body()?.user?.emailVerified).toBe(true);

    const cookie = cookieHeader(verify);
    const session = await server.inject.get("/api/auth/get-session", {
      headers: { ...HOST, cookie },
      query: { disableCookieCache: "true" },
    });
    expect(session.body()?.user?.email).toBe("magic@example.com");
  });

  it("rejects an unknown or already-consumed token", async () => {
    const { server, getCaptured } = setup();

    // no callbackURL was given, so a failed verify (GET, browser-navigable)
    // redirects to baseURL with an error query param rather than returning
    // a JSON error body.
    const bogus = await server.inject.get("/api/auth/magic-link/verify", {
      headers: HOST,
      query: { token: "not-a-real-token" },
    });
    expect(bogus.statusCode()).toBe(302);
    expect(bogus.headers()["location"]).toContain("error=");

    await server.inject.post("/api/auth/sign-in/magic-link", {
      body: { email: "onceonly@example.com" },
      headers: HOST,
    });
    const token = getCaptured()!.token;

    const first = await server.inject.get("/api/auth/magic-link/verify", {
      headers: HOST,
      query: { token },
    });
    expect(first.statusCode()).toBe(200);

    const second = await server.inject.get("/api/auth/magic-link/verify", {
      headers: HOST,
      query: { token },
    });
    expect(second.statusCode()).toBe(302);
    expect(second.headers()["location"]).toContain("error=");
  });

  it("signs an existing user in via magic link", async () => {
    const { server, getCaptured } = setup();
    const email = "existing@example.com";
    await server.inject.post("/api/auth/sign-up/email", {
      body: { name: "Existing User", email, password: "irrelevant-here-123" },
      headers: HOST,
    });

    await server.inject.post("/api/auth/sign-in/magic-link", {
      body: { email },
      headers: HOST,
    });
    const token = getCaptured()!.token;

    const verify = await server.inject.get("/api/auth/magic-link/verify", {
      headers: HOST,
      query: { token },
    });
    expect(verify.statusCode()).toBe(200);
    expect(verify.body()?.user?.email).toBe(email);
  });
});
