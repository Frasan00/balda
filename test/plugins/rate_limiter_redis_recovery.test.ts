import { describe, expect, it } from "vitest";
import {
  redisRateLimitStorage,
  type RedisLikeClient,
} from "../../src/plugins/rate_limiter/redis_rate_limiter_storage.js";

const healthyClient = (): RedisLikeClient => ({
  incr: async () => 1,
  pexpire: async () => undefined,
  pttl: async () => 500,
  status: "ready",
});

describe("redisRateLimitStorage recovery", () => {
  it("discards a dead client and rebuilds on the next call", async () => {
    let created = 0;
    let closed = 0;
    const storage = redisRateLimitStorage({
      createClient: async () => {
        created += 1;
        if (created === 1) {
          return {
            ...healthyClient(),
            connected: false,
            incr: async () => {
              throw new Error("connection is closed");
            },
            close: () => {
              closed += 1;
            },
          };
        }
        return healthyClient();
      },
    });

    await expect(storage.increment("k", 1_000)).rejects.toThrow(
      "connection is closed",
    );
    expect(closed).toBe(1);

    // Before the fix this awaited the same dead client and rejected again.
    const second = await storage.increment("k", 1_000);
    expect(second.count).toBe(1);
    expect(created).toBe(2);
  });

  it("retries after the client factory itself fails", async () => {
    let created = 0;
    const storage = redisRateLimitStorage({
      createClient: async () => {
        created += 1;
        if (created === 1) {
          throw new Error("ioredis is required");
        }
        return healthyClient();
      },
    });

    await expect(storage.increment("k", 1_000)).rejects.toThrow(
      "ioredis is required",
    );
    expect((await storage.increment("k", 1_000)).count).toBe(1);
    expect(created).toBe(2);
  });

  it("keeps a healthy client when a single command fails", async () => {
    let created = 0;
    let incrCalls = 0;
    const storage = redisRateLimitStorage({
      createClient: async () => {
        created += 1;
        return {
          ...healthyClient(),
          incr: async () => {
            incrCalls += 1;
            if (incrCalls === 1) {
              throw new Error("WRONGTYPE");
            }
            return 3;
          },
        };
      },
    });

    await expect(storage.increment("k", 1_000)).rejects.toThrow("WRONGTYPE");
    expect(created).toBe(1);
    expect((await storage.increment("k", 1_000)).count).toBe(3);
  });

  it("reports the reset and survives a rejecting teardown", async () => {
    const resets: unknown[] = [];
    let created = 0;
    const storage = redisRateLimitStorage({
      onClientReset: (err) => resets.push(err),
      createClient: async () => {
        created += 1;
        if (created === 1) {
          return {
            ...healthyClient(),
            status: "reconnecting",
            incr: async () => {
              throw new Error("broken pipe");
            },
            disconnect: () => Promise.reject(new Error("teardown failed")),
          };
        }
        return healthyClient();
      },
    });

    await expect(storage.increment("k", 1_000)).rejects.toThrow("broken pipe");
    expect(resets).toHaveLength(1);
    expect((await storage.increment("k", 1_000)).count).toBe(1);
  });
});
