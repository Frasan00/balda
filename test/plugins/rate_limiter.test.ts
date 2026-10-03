import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomStorageStrategy } from "../../src/plugins/rate_limiter/rate_limiter_types.js";
import { router } from "../../src/server/router/router.js";
import { Server } from "../../src/server/server.js";

beforeEach(() => {
  router.clearRoutes();
});

afterEach(() => {
  router.clearRoutes();
  vi.restoreAllMocks();
});

describe("rateLimiter", () => {
  it("adds a machine-readable code to 429 bodies and honors a custom one", async () => {
    const server = new Server({
      swagger: false,
      plugins: {
        rateLimiter: {
          keyOptions: {
            type: "ip",
            limit: 1,
            message: "slow down",
            code: "CUSTOM_CODE",
          },
          storageOptions: { type: "memory", windowMs: 1_000 },
        },
      },
    });
    server.router.get("/limited", (_req, res) => res.json({ ok: true }));

    await server.inject.get("/limited", { ip: "10.0.0.1" });
    const second = await server.inject.get("/limited", { ip: "10.0.0.1" });

    expect(second.statusCode()).toBe(429);
    expect(second.body()).toEqual({
      message: "slow down",
      code: "CUSTOM_CODE",
    });
  });

  it("fails closed by default for custom storage and reports the failure", async () => {
    const onStorageError = vi.fn();
    const increment = vi.fn(async () => {
      throw new Error("redis down");
    });
    const server = new Server({
      swagger: false,
      plugins: {
        rateLimiter: {
          keyOptions: { type: "custom", key: () => "acct:1", onStorageError },
          storageOptions: {
            type: "custom",
            increment,
          } as CustomStorageStrategy,
        },
      },
    });
    server.router.get("/limited", (_req, res) => res.json({ ok: true }));

    const res = await server.inject.get("/limited");

    expect(res.statusCode()).toBe(429);
    expect(onStorageError).toHaveBeenCalledTimes(1);
    const [error, key, windowMs] = onStorageError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(key).toBe("acct:1");
    expect(windowMs).toBe(60_000);
  });

  it("still fails open for custom storage when failClosed is false", async () => {
    const onStorageError = vi.fn();
    const server = new Server({
      swagger: false,
      plugins: {
        rateLimiter: {
          keyOptions: {
            type: "custom",
            key: () => "acct:1",
            failClosed: false,
            onStorageError,
          },
          storageOptions: {
            type: "custom",
            increment: async () => {
              throw new Error("redis down");
            },
          } as CustomStorageStrategy,
        },
      },
    });
    server.router.get("/limited", (_req, res) => res.json({ ok: true }));

    const res = await server.inject.get("/limited");

    expect(res.statusCode()).toBe(200);
    expect(onStorageError).toHaveBeenCalledTimes(1);
  });

  it("forwards windowMs to custom storage instead of hardcoding 60s", async () => {
    const increment = vi.fn(async () => ({
      count: 1,
      resetAt: Date.now() + 1_234,
    }));
    const server = new Server({
      swagger: false,
      plugins: {
        rateLimiter: {
          keyOptions: { type: "custom", key: () => "acct:1" },
          storageOptions: {
            type: "custom",
            windowMs: 1_234,
            increment,
          } as CustomStorageStrategy,
        },
      },
    });
    server.router.get("/limited", (_req, res) => res.json({ ok: true }));

    await server.inject.get("/limited");

    expect(increment).toHaveBeenCalledWith("acct:1", 1_234);
  });
});
