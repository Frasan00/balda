import { afterEach, describe, expect, it } from "vitest";
import { redisRateLimitStorage } from "../../src/plugins/rate_limiter/redis_rate_limiter_storage.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "root";
const KEY_PREFIX = `test:rl:${Date.now()}:`;

const storageOptions = (keyPrefix: string) =>
  redisRateLimitStorage({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    keyPrefix,
  });

afterEach(() => {
  router.clearRoutes();
});

describe("redisRateLimitStorage", () => {
  it("increments within a fixed window", async () => {
    const storage = storageOptions(KEY_PREFIX);
    const windowMs = 300;

    const first = await storage.increment("k1", windowMs);
    const second = await storage.increment("k1", windowMs);

    expect(first.count).toBe(1);
    expect(first.resetAt).toBeGreaterThan(Date.now());
    expect(second.count).toBe(2);
    expect(second.resetAt).toBeGreaterThan(Date.now());
  });

  it("enforces the limit through the server", async () => {
    const server = new Server({
      swagger: false,
      plugins: {
        rateLimiter: {
          keyOptions: { type: "custom", key: () => "k2", limit: 1 },
          storageOptions: { ...storageOptions(KEY_PREFIX), windowMs: 300 },
        },
      },
    });
    server.router.get("/limited", (_req, res) => res.json({ ok: true }));

    await server.inject.get("/limited");
    const second = await server.inject.get("/limited");

    expect(second.statusCode()).toBe(429);
  });
});
