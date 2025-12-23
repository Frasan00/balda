import { describe, expect, it } from "vitest";
import { BaseQueue } from "../../src/queue/base_queue.js";

describe("BaseQueue", () => {
  it("should provide logger instance to subclasses", () => {
    class TestQueue extends BaseQueue {}

    const queue = new TestQueue();
    expect(queue["logger"]).toBeDefined();
    expect(queue["logger"]).toHaveProperty("info");
    expect(queue["logger"]).toHaveProperty("error");
    expect(queue["logger"]).toHaveProperty("warn");
    expect(queue["logger"]).toHaveProperty("debug");
  });

  it("should set logger scope to class name", () => {
    class MyCustomQueue extends BaseQueue {}

    const queue = new MyCustomQueue();
    const logger = queue["logger"];

    expect(logger.bindings()).toHaveProperty("scope", "MyCustomQueue");
  });

  it("should provide isolated logger for each subclass", () => {
    class QueueA extends BaseQueue {}
    class QueueB extends BaseQueue {}

    const queueA = new QueueA();
    const queueB = new QueueB();

    const loggerA = queueA["logger"];
    const loggerB = queueB["logger"];

    expect(loggerA.bindings().scope).toBe("QueueA");
    expect(loggerB.bindings().scope).toBe("QueueB");
    expect(loggerA).not.toBe(loggerB);
  });

  it("should allow logger usage in queue handler methods", async () => {
    class UserQueue extends BaseQueue {
      async processUser(userId: string) {
        this.logger.info({ userId }, "Processing user");
        return `processed-${userId}`;
      }
    }

    const queue = new UserQueue();
    const result = await queue.processUser("123");

    expect(result).toBe("processed-123");
  });

  it("should be extendable with custom properties", () => {
    class CustomQueue extends BaseQueue {
      private retryCount = 3;

      getRetryCount() {
        return this.retryCount;
      }
    }

    const queue = new CustomQueue();
    expect(queue.getRetryCount()).toBe(3);
    expect(queue["logger"]).toBeDefined();
  });
});
