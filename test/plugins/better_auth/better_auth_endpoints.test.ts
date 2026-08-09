import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MockResponse } from "../../../src/mock/mock_response.js";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * Exercises every better-auth core endpoint reachable through the adapter
 * with the current worktree services (no real database migrations, no real
 * SMTP, no real OAuth provider) — the goal is proving the adapter forwards
 * *every* shape of request/response better-auth's core API produces, not
 * re-testing better-auth's own business logic.
 *
 * The `admin`, `twoFactor`, and `magicLink` plugins are covered in their own
 * files (better_auth_admin.test.ts, better_auth_two_factor.test.ts,
 * better_auth_magic_link.test.ts) — none of them need infrastructure this
 * environment lacks: admin is RBAC over the same user/session tables, TOTP
 * is HMAC-SHA1 math computable from the enable response, and magicLink's
 * sendMagicLink callback is captured synchronously just like
 * sendResetPassword/sendVerificationEmail below.
 *
 * Deliberately NOT covered anywhere in this suite (genuinely need
 * infrastructure or ceremony this environment doesn't have):
 * - POST /sign-in/social, GET /callback/:id, POST /link-social,
 *   POST /refresh-token, POST /get-access-token, POST /account-info
 *   — all require a real OAuth provider (client id/secret + a live
 *   redirect), which no service in the worktree stack provides.
 * - POST /set-password — only reachable for a social-only account with no
 *   credential (i.e. after a social sign-in), same OAuth constraint.
 * - Passkey plugin endpoints — require simulating a WebAuthn authenticator
 *   (keypair generation, CBOR-encoded attestation/assertion objects), a
 *   different kind of infrastructure than any other plugin here needs.
 * - POST /update-session — updates app-defined custom session fields; this
 *   instance defines none, so there's nothing meaningful to send.
 *
 * Email-dependent endpoints (verify-email, reset-password) capture the
 * token via the sendVerificationEmail/sendResetPassword callbacks instead
 * of routing through mailcatcher — the callback firing with the right
 * token/url IS the integration point that matters here; actual delivery is
 * entirely better-auth's concern, not the adapter's.
 */
describe("betterAuthHandler - full core endpoint coverage", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const HOST = { host: "app.example.com" };
  const SECRET = "test-secret-at-least-32-characters-long";

  const makeAuth = (): {
    auth: Auth<any>;
    getVerifyToken: () => string;
    getResetToken: () => string;
  } => {
    let verifyToken = "";
    let resetToken = "";
    const auth = betterAuth({
      baseURL: "http://app.example.com",
      secret: SECRET,
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ token }) => {
          resetToken = token;
        },
      },
      emailVerification: {
        sendVerificationEmail: async ({ token }) => {
          verifyToken = token;
        },
      },
      user: {
        changeEmail: { enabled: true, updateEmailWithoutVerification: true },
        deleteUser: { enabled: true },
      },
    });
    return {
      auth,
      getVerifyToken: () => verifyToken,
      getResetToken: () => resetToken,
    };
  };

  const setup = () => {
    const { auth, getVerifyToken, getResetToken } = makeAuth();
    mountBetterAuth(auth);
    const server = new Server();
    return { auth, server, getVerifyToken, getResetToken };
  };

  const cookieHeader = (res: MockResponse): string =>
    res
      .rawCookieHeaders()
      .map((c) => c.split(";")[0])
      .join("; ");

  const signUp = async (
    server: Server,
    creds: { name: string; email: string; password: string },
  ) => {
    const res = await server.inject.post("/api/auth/sign-up/email", {
      body: creds,
      headers: HOST,
    });
    expect(res.statusCode()).toBe(200);
    return cookieHeader(res);
  };

  const signIn = async (
    server: Server,
    creds: { email: string; password: string },
  ) => {
    const res = await server.inject.post("/api/auth/sign-in/email", {
      body: creds,
      headers: HOST,
    });
    expect(res.statusCode()).toBe(200);
    return { res, cookie: cookieHeader(res) };
  };

  // Bypasses better-auth's cookie cache so every read hits the DB — the
  // in-path query string balda's mock server wipes (see MockServer.request,
  // `url.search` is rebuilt from `options.query`), so it must be passed
  // through `query`, not embedded in the path string.
  const getSession = (server: Server, cookie: string) =>
    server.inject.get("/api/auth/get-session", {
      headers: { ...HOST, cookie },
      query: { disableCookieCache: "true" },
    });

  it("GET /ok and GET /error respond without a session", async () => {
    const { server } = setup();

    const ok = await server.inject.get("/api/auth/ok", { headers: HOST });
    expect(ok.statusCode()).toBe(200);
    expect(ok.body()).toEqual({ ok: true });

    const err = await server.inject.get("/api/auth/error", {
      headers: HOST,
    });
    expect(err.statusCode()).toBeLessThan(500);
  });

  it("runs the full authenticated-user journey through one session", async () => {
    const { server, getVerifyToken } = setup();
    const email = "journey@example.com";
    const password = "correct-horse-battery-staple";

    // sign-up/email
    const cookie = await signUp(server, {
      name: "Journey User",
      email,
      password,
    });

    // get-session
    const session1 = await getSession(server, cookie);
    expect(session1.statusCode()).toBe(200);
    expect(session1.body()?.user?.email).toBe(email);

    // list-sessions
    const sessions1 = await server.inject.get("/api/auth/list-sessions", {
      headers: { ...HOST, cookie },
    });
    expect(sessions1.statusCode()).toBe(200);
    expect(sessions1.body()).toHaveLength(1);

    // update-user
    const updated = await server.inject.post("/api/auth/update-user", {
      body: { name: "Journey User Renamed" },
      headers: { ...HOST, cookie },
    });
    // update-user returns {status:true} and refreshes the session cookie —
    // the update itself is confirmed via get-session below.
    expect(updated.statusCode()).toBe(200);
    expect(updated.body()).toEqual({ status: true });

    const sessionAfterUpdate = await getSession(server, cookie);
    expect(sessionAfterUpdate.body()?.user?.name).toBe("Journey User Renamed");

    // verify-password (current password, unchanged so far)
    const verifyPw = await server.inject.post("/api/auth/verify-password", {
      body: { password },
      headers: { ...HOST, cookie },
    });
    expect(verifyPw.statusCode()).toBe(200);

    // change-password
    const newPassword = "new-correct-horse-battery-staple";
    const changePw = await server.inject.post("/api/auth/change-password", {
      body: { currentPassword: password, newPassword },
      headers: { ...HOST, cookie },
    });
    expect(changePw.statusCode()).toBe(200);

    // old password no longer works, new one does
    const oldSignIn = await server.inject.post("/api/auth/sign-in/email", {
      body: { email, password },
      headers: HOST,
    });
    expect(oldSignIn.statusCode()).toBeGreaterThanOrEqual(400);
    await signIn(server, { email, password: newPassword });

    // send-verification-email + verify-email
    const sendVerify = await server.inject.post(
      "/api/auth/send-verification-email",
      { body: { email }, headers: { ...HOST, cookie } },
    );
    expect(sendVerify.statusCode()).toBe(200);
    expect(getVerifyToken()).toBeTruthy();

    const verifyEmail = await server.inject.get("/api/auth/verify-email", {
      headers: HOST,
      query: { token: getVerifyToken() },
    });
    expect(verifyEmail.statusCode()).toBeLessThan(400);

    // change-email (updateEmailWithoutVerification: true — applies immediately)
    const newEmail = "journey-new@example.com";
    const changeEmail = await server.inject.post("/api/auth/change-email", {
      body: { newEmail },
      headers: { ...HOST, cookie },
    });
    expect(changeEmail.statusCode()).toBe(200);

    const sessionAfter = await getSession(server, cookie);
    expect(sessionAfter.body()?.user?.email).toBe(newEmail);

    // list-accounts — the credential account created at sign-up
    const accounts = await server.inject.get("/api/auth/list-accounts", {
      headers: { ...HOST, cookie },
    });
    expect(accounts.statusCode()).toBe(200);
    const accountsBody = accounts.body();
    expect(accountsBody).toHaveLength(1);
    expect(accountsBody[0].providerId).toBe("credential");

    // unlink-account — rejected: it's the user's only account
    const unlink = await server.inject.post("/api/auth/unlink-account", {
      body: { providerId: "credential" },
      headers: { ...HOST, cookie },
    });
    expect(unlink.statusCode()).toBeGreaterThanOrEqual(400);

    // sign-out invalidates the session
    const signOut = await server.inject.post("/api/auth/sign-out", {
      headers: { ...HOST, cookie },
    });
    expect(signOut.statusCode()).toBe(200);

    const sessionAfterSignOut = await getSession(server, cookie);
    expect(sessionAfterSignOut.body()).toBeFalsy();
  });

  it("resets a forgotten password end to end", async () => {
    const { server, getResetToken } = setup();
    const email = "forgot@example.com";
    const password = "correct-horse-battery-staple";
    await signUp(server, { name: "Forgetful User", email, password });

    const request = await server.inject.post(
      "/api/auth/request-password-reset",
      { body: { email }, headers: HOST },
    );
    expect(request.statusCode()).toBe(200);
    expect(getResetToken()).toBeTruthy();

    // GET /reset-password/:token redirects to callbackURL with the token
    const redirect = await server.inject(
      "GET" as any,
      `/api/auth/reset-password/${getResetToken()}`,
      { query: { callbackURL: "/done" }, headers: HOST },
    );
    expect(redirect.statusCode()).toBeGreaterThanOrEqual(300);
    expect(redirect.statusCode()).toBeLessThan(400);

    const newPassword = "brand-new-password-123";
    const reset = await server.inject.post("/api/auth/reset-password", {
      body: { newPassword, token: getResetToken() },
      headers: HOST,
    });
    expect(reset.statusCode()).toBe(200);

    await signIn(server, { email, password: newPassword });
  });

  it("revokes sessions individually, all-but-current, and all", async () => {
    const { server } = setup();
    const email = "multisession@example.com";
    const password = "correct-horse-battery-staple";
    // sign-up itself creates a session too, so this starts at 3, not 2.
    const cookie0 = await signUp(server, {
      name: "Multi Session",
      email,
      password,
    });

    const { cookie: cookieA } = await signIn(server, { email, password });
    const { cookie: cookieB } = await signIn(server, { email, password });

    const listViaA = await server.inject.get("/api/auth/list-sessions", {
      headers: { ...HOST, cookie: cookieA },
    });
    expect(listViaA.body()).toHaveLength(3);

    // revoke-other-sessions from A leaves only A alive (both the sign-up
    // session and B get revoked as "other" sessions)
    const revokeOthers = await server.inject.post(
      "/api/auth/revoke-other-sessions",
      { headers: { ...HOST, cookie: cookieA } },
    );
    expect(revokeOthers.statusCode()).toBe(200);

    const sessionVia0 = await getSession(server, cookie0);
    expect(sessionVia0.body()).toBeFalsy();

    const sessionViaB = await getSession(server, cookieB);
    expect(sessionViaB.body()).toBeFalsy();

    const sessionViaA = await getSession(server, cookieA);
    expect(sessionViaA.body()?.user?.email).toBe(email);

    // sign in again for a fresh second session, then revoke it by token
    const { cookie: cookieC } = await signIn(server, { email, password });
    const listViaA2 = await server.inject.get("/api/auth/list-sessions", {
      headers: { ...HOST, cookie: cookieA },
    });
    expect(listViaA2.body()).toHaveLength(2);
    const tokenC = listViaA2
      .body()
      .find((s: any) => cookieC.includes(s.token))?.token;
    expect(tokenC).toBeTruthy();

    const revokeOne = await server.inject.post("/api/auth/revoke-session", {
      body: { token: tokenC },
      headers: { ...HOST, cookie: cookieA },
    });
    expect(revokeOne.statusCode()).toBe(200);

    const sessionViaC = await getSession(server, cookieC);
    expect(sessionViaC.body()).toBeFalsy();

    // revoke-sessions clears everything, including the caller's own session
    const revokeAll = await server.inject.post("/api/auth/revoke-sessions", {
      headers: { ...HOST, cookie: cookieA },
    });
    expect(revokeAll.statusCode()).toBe(200);

    const sessionViaAAfter = await getSession(server, cookieA);
    expect(sessionViaAAfter.body()).toBeFalsy();
  });

  it("deletes the user with a password confirmation", async () => {
    const { server } = setup();
    const email = "deleteme@example.com";
    const password = "correct-horse-battery-staple";
    const cookie = await signUp(server, {
      name: "Delete Me",
      email,
      password,
    });

    const del = await server.inject.post("/api/auth/delete-user", {
      body: { password },
      headers: { ...HOST, cookie },
    });
    expect(del.statusCode()).toBe(200);

    const signInAfter = await server.inject.post("/api/auth/sign-in/email", {
      body: { email, password },
      headers: HOST,
    });
    expect(signInAfter.statusCode()).toBeGreaterThanOrEqual(400);
  });
});
