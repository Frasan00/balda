import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { admin } from "better-auth/plugins";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MockResponse } from "../../../src/mock/mock_response.js";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * The `admin` plugin is pure role-based access control on top of the same
 * user/session tables every other test in this suite already exercises —
 * it needs no external service (no OAuth, no SMTP, no WebAuthn), so unlike
 * passkey/social sign-in it's fully testable here.
 *
 * There's no built-in "first user is admin" bootstrap: an admin is either
 * role: "admin" or listed in `adminUserIds`. `adminUserIds` is read at
 * request time, not frozen at construction, so the array is created empty
 * and mutated once the candidate admin's real (server-generated) id is
 * known from their sign-up response — sidesteps needing to predict an id
 * the in-memory adapter generates itself.
 */
describe("betterAuthHandler - admin plugin", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const HOST = { host: "app.example.com" };
  const SECRET = "test-secret-at-least-32-characters-long";

  const setup = () => {
    const adminUserIds: string[] = [];
    const auth: Auth<any> = betterAuth({
      baseURL: "http://app.example.com",
      secret: SECRET,
      emailAndPassword: { enabled: true },
      plugins: [admin({ adminUserIds })],
    });
    mountBetterAuth(auth);
    const server = new Server();
    return { auth, server, adminUserIds };
  };

  // A real cookie jar: a later Set-Cookie for the same name overwrites an
  // earlier one, and Max-Age=0 means "delete". impersonate-user clears the
  // admin's session and sets a replacement in the *same* response — naively
  // joining every raw Set-Cookie (as a plain split/join would) sends the
  // stale cleared value alongside the live one and breaks the next request.
  const cookieHeader = (res: MockResponse): string => {
    const jar = new Map<string, string>();
    for (const raw of res.rawCookieHeaders()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const isCleared = attrs
        .map((a) => a.trim())
        .some((a) => a.toLowerCase() === "max-age=0");
      if (isCleared) jar.delete(name);
      else jar.set(name, value);
    }
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  };

  const signUp = async (
    server: Server,
    creds: { name: string; email: string; password: string },
  ) => {
    const res = await server.inject.post("/api/auth/sign-up/email", {
      body: creds,
      headers: HOST,
    });
    expect(res.statusCode()).toBe(200);
    return { cookie: cookieHeader(res), id: res.body()?.user?.id as string };
  };

  const signIn = async (
    server: Server,
    creds: { email: string; password: string },
  ) => {
    const res = await server.inject.post("/api/auth/sign-in/email", {
      body: creds,
      headers: HOST,
    });
    return { res, cookie: cookieHeader(res) };
  };

  const getSession = (server: Server, cookie: string) =>
    server.inject.get("/api/auth/get-session", {
      headers: { ...HOST, cookie },
      query: { disableCookieCache: "true" },
    });

  it("runs the full admin journey: RBAC, user CRUD, sessions, ban, impersonation", async () => {
    const { server, adminUserIds } = setup();
    const password = "correct-horse-battery-staple";

    const admin1 = await signUp(server, {
      name: "Admin",
      email: "admin@example.com",
      password,
    });
    adminUserIds.push(admin1.id);
    const adminCookie = admin1.cookie;

    const regular = await signUp(server, {
      name: "Regular",
      email: "regular@example.com",
      password,
    });

    // non-admins are rejected
    const forbidden = await server.inject.post("/api/auth/admin/create-user", {
      body: {
        email: "nope@example.com",
        password: "nope-pw-123456",
        name: "Nope",
      },
      headers: { ...HOST, cookie: regular.cookie },
    });
    expect(forbidden.statusCode()).toBe(403);

    // create-user
    const create = await server.inject.post("/api/auth/admin/create-user", {
      body: {
        email: "created@example.com",
        password: "created-pw-123456",
        name: "Created User",
        role: "user",
      },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(create.statusCode()).toBe(200);
    const createdUserId: string = create.body()?.user?.id;
    expect(createdUserId).toBeTruthy();

    // set-role
    const setRole = await server.inject.post("/api/auth/admin/set-role", {
      body: { userId: createdUserId, role: "editor" },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(setRole.statusCode()).toBe(200);
    expect(setRole.body()?.user?.role).toBe("editor");

    // get-user
    const getUser = await server.inject.get("/api/auth/admin/get-user", {
      headers: { ...HOST, cookie: adminCookie },
      query: { id: createdUserId },
    });
    expect(getUser.statusCode()).toBe(200);
    expect(getUser.body()?.email).toBe("created@example.com");

    // update-user (admin-side arbitrary field update, distinct from the
    // user's own /update-user which only touches their own record)
    const updateUser = await server.inject.post("/api/auth/admin/update-user", {
      body: { userId: createdUserId, data: { name: "Renamed By Admin" } },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(updateUser.statusCode()).toBe(200);
    expect(updateUser.body()?.name).toBe("Renamed By Admin");

    // list-users
    const listUsers = await server.inject.get("/api/auth/admin/list-users", {
      headers: { ...HOST, cookie: adminCookie },
      query: { limit: "50" },
    });
    expect(listUsers.statusCode()).toBe(200);
    const listedIds = listUsers.body()?.users?.map((u: any) => u.id);
    expect(listedIds).toEqual(
      expect.arrayContaining([admin1.id, regular.id, createdUserId]),
    );

    // has-permission
    const hasPermission = await server.inject.post(
      "/api/auth/admin/has-permission",
      {
        body: { permissions: { user: ["list"] } },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(hasPermission.statusCode()).toBe(200);
    expect(hasPermission.body()?.success).toBe(true);

    // set-user-password, then sign in as that user with the new password
    const newPw = "admin-set-password-123456";
    const setPw = await server.inject.post(
      "/api/auth/admin/set-user-password",
      {
        body: { userId: createdUserId, newPassword: newPw },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(setPw.statusCode()).toBe(200);
    const { cookie: createdCookieA } = await signIn(server, {
      email: "created@example.com",
      password: newPw,
    });
    const { cookie: createdCookieB } = await signIn(server, {
      email: "created@example.com",
      password: newPw,
    });

    // list-user-sessions, then revoke one specific session
    const listSessions = await server.inject.post(
      "/api/auth/admin/list-user-sessions",
      {
        body: { userId: createdUserId },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(listSessions.statusCode()).toBe(200);
    const sessions = listSessions.body()?.sessions;
    expect(sessions).toHaveLength(2);
    const tokenB = sessions.find((s: any) =>
      createdCookieB.includes(s.token),
    )?.token;
    expect(tokenB).toBeTruthy();

    const revokeOne = await server.inject.post(
      "/api/auth/admin/revoke-user-session",
      {
        body: { sessionToken: tokenB },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(revokeOne.statusCode()).toBe(200);
    expect((await getSession(server, createdCookieB)).body()).toBeFalsy();
    expect((await getSession(server, createdCookieA)).body()?.user?.email).toBe(
      "created@example.com",
    );

    // ban-user blocks sign-in; unban-user restores it
    const ban = await server.inject.post("/api/auth/admin/ban-user", {
      body: { userId: createdUserId, banReason: "test" },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(ban.statusCode()).toBe(200);
    expect(ban.body()?.user?.banned).toBe(true);

    const bannedSignIn = await server.inject.post("/api/auth/sign-in/email", {
      body: { email: "created@example.com", password: newPw },
      headers: HOST,
    });
    expect(bannedSignIn.statusCode()).toBe(403);

    const unban = await server.inject.post("/api/auth/admin/unban-user", {
      body: { userId: createdUserId },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(unban.statusCode()).toBe(200);
    expect(unban.body()?.user?.banned).toBe(false);

    const { cookie: createdCookieC } = await signIn(server, {
      email: "created@example.com",
      password: newPw,
    });

    // revoke-user-sessions (plural) clears every session for the user
    const revokeAll = await server.inject.post(
      "/api/auth/admin/revoke-user-sessions",
      {
        body: { userId: createdUserId },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(revokeAll.statusCode()).toBe(200);
    expect((await getSession(server, createdCookieA)).body()).toBeFalsy();
    expect((await getSession(server, createdCookieC)).body()).toBeFalsy();

    // impersonate-user, verify the session belongs to the target, then
    // stop-impersonating reverts to the admin's own session
    const impersonate = await server.inject.post(
      "/api/auth/admin/impersonate-user",
      {
        body: { userId: createdUserId },
        headers: { ...HOST, cookie: adminCookie },
      },
    );
    expect(impersonate.statusCode()).toBe(200);
    const impersonateCookie = cookieHeader(impersonate);
    const impersonatedSession = await getSession(server, impersonateCookie);
    expect(impersonatedSession.body()?.user?.id).toBe(createdUserId);
    expect(impersonatedSession.body()?.session?.impersonatedBy).toBe(admin1.id);

    const stop = await server.inject.post(
      "/api/auth/admin/stop-impersonating",
      { headers: { ...HOST, cookie: impersonateCookie } },
    );
    expect(stop.statusCode()).toBe(200);
    expect(stop.body()?.user?.email).toBe("admin@example.com");

    // remove-user deletes the account entirely
    const remove = await server.inject.post("/api/auth/admin/remove-user", {
      body: { userId: createdUserId },
      headers: { ...HOST, cookie: adminCookie },
    });
    expect(remove.statusCode()).toBe(200);

    const listAfterRemove = await server.inject.get(
      "/api/auth/admin/list-users",
      { headers: { ...HOST, cookie: adminCookie }, query: { limit: "50" } },
    );
    const remainingIds = listAfterRemove.body()?.users?.map((u: any) => u.id);
    expect(remainingIds).not.toContain(createdUserId);
  });
});
