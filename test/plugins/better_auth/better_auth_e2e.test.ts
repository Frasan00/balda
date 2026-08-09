import { betterAuth } from "better-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * Exercises the adapter against a real better-auth instance end to end —
 * the stub-based tests in better_auth_handler.test.ts prove the forwarding
 * mechanics in isolation, this proves better-auth actually accepts what the
 * adapter sends it and that the round trip (sign up, sign in, read session)
 * works, including with the project's own bodyParser plugin in the mix.
 *
 * No database is configured: better-auth falls back to its in-memory
 * adapter, so this needs no infra beyond the worktree's node container.
 */
describe("betterAuthHandler + mountBetterAuth (real better-auth)", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const credentials = {
    name: "Balda User",
    email: "user@example.com",
    password: "correct-horse-battery-staple",
  };

  const signUpAndSignIn = async (server: Server) => {
    const signUp = await server.inject.post("/api/auth/sign-up/email", {
      body: credentials,
      headers: { host: "app.example.com" },
    });
    expect(signUp.statusCode()).toBe(200);

    const signIn = await server.inject.post("/api/auth/sign-in/email", {
      body: { email: credentials.email, password: credentials.password },
      headers: { host: "app.example.com" },
    });
    expect(signIn.statusCode()).toBe(200);
    return signIn;
  };

  it("signs up, signs in, and the resulting cookie is a valid session", async () => {
    const auth = betterAuth({
      baseURL: "http://app.example.com",
      secret: "test-secret-at-least-32-characters-long",
      emailAndPassword: { enabled: true },
    });
    mountBetterAuth(auth);
    const server = new Server();

    const signIn = await signUpAndSignIn(server);
    const cookies = signIn.rawCookieHeaders();
    expect(cookies.length).toBeGreaterThan(0);

    const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    expect(session?.user.email).toBe(credentials.email);
  });

  it("still works with the project's bodyParser plugin registered globally", async () => {
    const auth = betterAuth({
      baseURL: "http://app.example.com",
      secret: "test-secret-at-least-32-characters-long",
      emailAndPassword: { enabled: true },
    });
    mountBetterAuth(auth);
    // Realistic server config: bodyParser runs as global middleware before
    // the better-auth catch-all, so req.body is already parsed by the time
    // the adapter sees it (the "already-consumed request" gotcha).
    const server = new Server({ plugins: { bodyParser: { json: {} } } });

    const signIn = await signUpAndSignIn(server);
    const cookies = signIn.rawCookieHeaders();
    expect(cookies.length).toBeGreaterThan(0);

    const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    expect(session?.user.email).toBe(credentials.email);
  });

  it("works when bodyParser has no json option — falls through to its raw-ArrayBuffer fallback", async () => {
    // bodyParser only routes application/json through the json() sub-parser
    // when a `json` option is configured; otherwise it falls through to
    // `req.body = await req.toWebApi().arrayBuffer()`. This reproduces that
    // exact shape reaching the adapter.
    const auth = betterAuth({
      baseURL: "http://app.example.com",
      secret: "test-secret-at-least-32-characters-long",
      emailAndPassword: { enabled: true },
    });
    mountBetterAuth(auth);
    const server = new Server({
      plugins: { bodyParser: { fileParser: {} } },
    });

    const signIn = await signUpAndSignIn(server);
    expect(signIn.rawCookieHeaders().length).toBeGreaterThan(0);
  });
});
