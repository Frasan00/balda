import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * Every other file in this suite omits `database`, so better-auth falls
 * back to its in-memory adapter — good enough to prove the adapter forwards
 * requests/responses correctly, but it never exercises a real async DB
 * round trip. The balda<->better-auth bridge itself never touches the
 * database (it only forwards a Web Request/Response), so this isn't
 * expected to behave differently — this test exists to confirm that
 * assumption rather than take it on faith.
 *
 * Uses the same `postgres` service (and pg client) the queue tests already
 * connect to — no new infrastructure or dependency.
 */
describe("betterAuthHandler + mountBetterAuth (real postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: `postgres://${process.env.POSTGRES_USER || "root"}:${process.env.POSTGRES_PASSWORD || "root"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "database"}`,
    });
  });

  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const HOST = { host: "app.example.com" };
  const SECRET = "test-secret-at-least-32-characters-long";
  // Postgres is a real, persistent database — unlike the in-memory adapter
  // used everywhere else in this suite, rows survive across test runs and
  // across the separate node/bun/deno containers all pointed at the same
  // instance. A fixed email would collide with a previous run's row and
  // fail sign-up with a duplicate-account error, so each run gets its own.
  const email = `postgres-user-${randomUUID()}@example.com`;
  const credentials = {
    name: "Postgres User",
    email,
    password: "correct-horse-battery-staple",
  };

  afterAll(async () => {
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    await pool.end();
  });

  it("runs migrations against real postgres and completes a sign-up/sign-in/session round trip", async () => {
    const auth = betterAuth({
      baseURL: "http://app.example.com",
      secret: SECRET,
      database: pool,
      emailAndPassword: { enabled: true },
    });

    // Applies better-auth's own schema (user/session/account/verification
    // tables) — the same step `@better-auth/cli migrate` runs, called
    // programmatically since there's no interactive shell here.
    const { runMigrations } = await getMigrations(auth.options as any);
    await runMigrations();

    mountBetterAuth(auth);
    const server = new Server();

    const signUp = await server.inject.post("/api/auth/sign-up/email", {
      body: credentials,
      headers: HOST,
    });
    expect(signUp.statusCode()).toBe(200);

    const signIn = await server.inject.post("/api/auth/sign-in/email", {
      body: { email: credentials.email, password: credentials.password },
      headers: HOST,
    });
    expect(signIn.statusCode()).toBe(200);

    const cookie = signIn
      .rawCookieHeaders()
      .map((c) => c.split(";")[0])
      .join("; ");

    // disableCookieCache forces this through the adapter -> better-auth ->
    // pg round trip instead of the short-lived encrypted cookie cache.
    const session = await server.inject.get("/api/auth/get-session", {
      headers: { ...HOST, cookie },
      query: { disableCookieCache: "true" },
    });
    expect(session.statusCode()).toBe(200);
    expect(session.body()?.user?.email).toBe(credentials.email);

    // confirm the row actually landed in postgres, not just in an
    // in-process cache the adapter or better-auth might be holding
    const { rows } = await pool.query(
      'SELECT email FROM "user" WHERE email = $1',
      [credentials.email],
    );
    expect(rows).toHaveLength(1);
  });
});
