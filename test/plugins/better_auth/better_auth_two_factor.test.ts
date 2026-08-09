import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MockResponse } from "../../../src/mock/mock_response.js";
import { mountBetterAuth } from "../../../src/plugins/better_auth/better_auth.js";
import { router } from "../../../src/server/router/router.js";
import { Server } from "../../../src/server/server.js";

/**
 * TOTP-based 2FA (RFC 6238) is deterministic HMAC-SHA1 math over a shared
 * secret — no SMS/email round trip needed, unlike the `otp` 2FA method
 * (sendOTP), which is genuinely untestable here for the same reason
 * verify-email/reset-password's real delivery is out of scope. A real code
 * is computed directly from the secret embedded in the `totpURI` better-auth
 * returns from /two-factor/enable, exactly like a real authenticator app
 * would derive it from a scanned QR code.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (encoded: string): Buffer => {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of clean) {
    bits += BASE32_ALPHABET.indexOf(char).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

/** RFC 6238 TOTP: SHA1, 6 digits, 30s step — better-auth's defaults. */
const generateTOTP = (base32Secret: string, timeMs = Date.now()): string => {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(timeMs / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1_000_000).toString().padStart(6, "0");
};

describe("betterAuthHandler - twoFactor plugin", () => {
  beforeEach(() => {
    router.clearRoutes();
  });

  afterEach(() => {
    router.clearRoutes();
  });

  const HOST = { host: "app.example.com" };
  const SECRET = "test-secret-at-least-32-characters-long";
  const password = "correct-horse-battery-staple";

  const setup = () => {
    const auth: Auth<any> = betterAuth({
      baseURL: "http://app.example.com",
      secret: SECRET,
      emailAndPassword: { enabled: true },
      plugins: [twoFactor()],
    });
    mountBetterAuth(auth);
    const server = new Server();
    return { auth, server };
  };

  const cookieHeader = (res: MockResponse): string => {
    const jar = new Map<string, string>();
    for (const raw of res.rawCookieHeaders()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const cleared = attrs
        .map((a) => a.trim().toLowerCase())
        .includes("max-age=0");
      if (cleared) jar.delete(name);
      else jar.set(name, value);
    }
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  };

  const signIn = async (server: Server) => {
    const res = await server.inject.post("/api/auth/sign-in/email", {
      body: { email: "twofa@example.com", password },
      headers: HOST,
    });
    expect(res.statusCode()).toBe(200);
    return { res, cookie: cookieHeader(res) };
  };

  it("runs the full TOTP lifecycle: enable, sign-in challenge, verify, backup codes, disable", async () => {
    const { server } = setup();

    const signUp = await server.inject.post("/api/auth/sign-up/email", {
      body: { name: "TwoFA User", email: "twofa@example.com", password },
      headers: HOST,
    });
    expect(signUp.statusCode()).toBe(200);
    const signUpCookie = cookieHeader(signUp);

    // enable: provisions a secret + backup codes, but doesn't flip
    // twoFactorEnabled yet — that happens once setup is confirmed below.
    const enable = await server.inject.post("/api/auth/two-factor/enable", {
      body: { password },
      headers: { ...HOST, cookie: signUpCookie },
    });
    expect(enable.statusCode()).toBe(200);
    const totpURI: string = enable.body()?.totpURI;
    expect(totpURI).toContain("otpauth://totp/");
    const secret = new URL(totpURI).searchParams.get("secret");
    expect(secret).toBeTruthy();
    expect(enable.body()?.backupCodes?.length).toBeGreaterThan(0);

    // confirm setup — verify-totp against the normal (already authenticated)
    // session, not a pending 2FA challenge.
    const confirm = await server.inject.post(
      "/api/auth/two-factor/verify-totp",
      {
        body: { code: generateTOTP(secret!) },
        headers: { ...HOST, cookie: signUpCookie },
      },
    );
    expect(confirm.statusCode()).toBe(200);

    // sign-in now issues a challenge instead of a session
    const signIn1 = await server.inject.post("/api/auth/sign-in/email", {
      body: { email: "twofa@example.com", password },
      headers: HOST,
    });
    expect(signIn1.statusCode()).toBe(200);
    expect(signIn1.body()).toEqual({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    const twoFactorCookie = cookieHeader(signIn1);

    // wrong code is rejected, and doesn't consume the pending-challenge cookie
    const wrong = await server.inject.post("/api/auth/two-factor/verify-totp", {
      body: { code: "000000" },
      headers: { ...HOST, cookie: twoFactorCookie },
    });
    expect(wrong.statusCode()).toBe(401);

    // correct code on the same still-pending cookie completes sign-in
    const verify = await server.inject.post(
      "/api/auth/two-factor/verify-totp",
      {
        body: { code: generateTOTP(secret!) },
        headers: { ...HOST, cookie: twoFactorCookie },
      },
    );
    expect(verify.statusCode()).toBe(200);
    const sessionCookie = cookieHeader(verify);

    const session = await server.inject.get("/api/auth/get-session", {
      headers: { ...HOST, cookie: sessionCookie },
      query: { disableCookieCache: "true" },
    });
    expect(session.body()?.user?.twoFactorEnabled).toBe(true);

    // the pending cookie is single-use — reusing it now fails even with the
    // right code
    const reuse = await server.inject.post("/api/auth/two-factor/verify-totp", {
      body: { code: generateTOTP(secret!) },
      headers: { ...HOST, cookie: twoFactorCookie },
    });
    expect(reuse.statusCode()).toBe(401);

    // regenerate backup codes, then use one to satisfy a 2FA challenge
    const regenerate = await server.inject.post(
      "/api/auth/two-factor/generate-backup-codes",
      { body: { password }, headers: { ...HOST, cookie: sessionCookie } },
    );
    expect(regenerate.statusCode()).toBe(200);
    const backupCode: string = regenerate.body()?.backupCodes?.[0];
    expect(backupCode).toBeTruthy();

    const { cookie: challenge2 } = await signIn(server);
    const verifyBackup = await server.inject.post(
      "/api/auth/two-factor/verify-backup-code",
      { body: { code: backupCode }, headers: { ...HOST, cookie: challenge2 } },
    );
    expect(verifyBackup.statusCode()).toBe(200);

    // backup codes are single-use
    const { cookie: challenge3 } = await signIn(server);
    const reuseBackup = await server.inject.post(
      "/api/auth/two-factor/verify-backup-code",
      { body: { code: backupCode }, headers: { ...HOST, cookie: challenge3 } },
    );
    expect(reuseBackup.statusCode()).toBe(401);

    // disable turns 2FA off — sign-in goes back to a normal session
    const disable = await server.inject.post("/api/auth/two-factor/disable", {
      body: { password },
      headers: { ...HOST, cookie: cookieHeader(verifyBackup) },
    });
    expect(disable.statusCode()).toBe(200);

    const signInAfterDisable = await server.inject.post(
      "/api/auth/sign-in/email",
      { body: { email: "twofa@example.com", password }, headers: HOST },
    );
    expect(signInAfterDisable.statusCode()).toBe(200);
    expect(signInAfterDisable.body()?.user?.twoFactorEnabled).toBe(false);
  });
});
