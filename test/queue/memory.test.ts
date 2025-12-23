import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryQueue } from "../../src/queue/factories.js";
import { MemoryPubSub } from "../../src/queue/providers/memory/memory.js";
import { QueueManager } from "../../src/queue/queue.js";

describe("Memory Queue Provider", () => {
  type TestPayload = { id: number; message: string };

  // Clear the shared memory provider before each test to ensure isolation
  afterEach(() => {
    QueueManager.clearMemoryProvider();
  });

  describe("MemoryPubSub", () => {
    let pubsub: MemoryPubSub;

    beforeEach(() => {
      pubsub = new MemoryPubSub();
    });

    it("should publish and process messages in memory", async () => {
      const messages: TestPayload[] = [];
      const topic = "test-topic";

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        messages.push(payload);
      });

      const result = await pubsub.publish(topic, { id: 1, message: "test" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.id).toBeDefined();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 1, message: "test" });
    });

    it("should handle multiple subscribers for same topic", async () => {
      const messages1: TestPayload[] = [];
      const messages2: TestPayload[] = [];
      const topic = "multi-subscriber";

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        messages1.push(payload);
      });

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        messages2.push(payload);
      });

      await pubsub.publish(topic, { id: 1, message: "broadcast" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages1).toHaveLength(1);
      expect(messages2).toHaveLength(1);
      expect(messages1[0]).toEqual({ id: 1, message: "broadcast" });
      expect(messages2[0]).toEqual({ id: 1, message: "broadcast" });
    });

    it("should process messages in queue order", async () => {
      const processedOrder: number[] = [];
      const topic = "ordered-topic";

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        processedOrder.push(payload.id);
      });

      await pubsub.publish(topic, { id: 1, message: "first" });
      await pubsub.publish(topic, { id: 2, message: "second" });
      await pubsub.publish(topic, { id: 3, message: "third" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processedOrder).toEqual([1, 2, 3]);
    });

    it("should handle errors in subscribers without stopping queue", async () => {
      const successMessages: TestPayload[] = [];
      const topic = "error-handling";

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        if (payload.id === 2) {
          throw new Error("Simulated error");
        }
        successMessages.push(payload);
      });

      await pubsub.publish(topic, { id: 1, message: "first" });
      await pubsub.publish(topic, { id: 2, message: "error" });
      await pubsub.publish(topic, { id: 3, message: "third" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(successMessages).toHaveLength(2);
      expect(successMessages[0].id).toBe(1);
      expect(successMessages[1].id).toBe(3);
    });

    it("should handle different topics independently", async () => {
      const topic1Messages: TestPayload[] = [];
      const topic2Messages: TestPayload[] = [];

      await pubsub.subscribe<TestPayload>("topic1", async (payload) => {
        topic1Messages.push(payload);
      });

      await pubsub.subscribe<TestPayload>("topic2", async (payload) => {
        topic2Messages.push(payload);
      });

      await pubsub.publish("topic1", { id: 1, message: "topic1-msg" });
      await pubsub.publish("topic2", { id: 2, message: "topic2-msg" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(topic1Messages).toHaveLength(1);
      expect(topic2Messages).toHaveLength(1);
      expect(topic1Messages[0].message).toBe("topic1-msg");
      expect(topic2Messages[0].message).toBe("topic2-msg");
    });

    it("should unsubscribe handlers properly", async () => {
      const messages: TestPayload[] = [];
      const topic = "unsubscribe-test";

      await pubsub.subscribe<TestPayload>(topic, async (payload) => {
        messages.push(payload);
      });

      await pubsub.publish(topic, { id: 1, message: "before unsubscribe" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);

      await pubsub.unsubscribe(topic);

      await pubsub.publish(topic, { id: 2, message: "after unsubscribe" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
    });
  });

  describe("memoryQueue factory", () => {
    it("should create working typed queue", async () => {
      const messages: TestPayload[] = [];
      const queue = memoryQueue<TestPayload>("factory-test");

      await queue.subscribe(async (payload) => {
        messages.push(payload);
      });

      await queue.publish({ id: 1, message: "factory test" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 1, message: "factory test" });
    });

    it("should support unsubscribe", async () => {
      const messages: TestPayload[] = [];
      const queue = memoryQueue<TestPayload>("unsubscribe-factory-test");

      await queue.subscribe(async (payload) => {
        messages.push(payload);
      });

      await queue.publish({ id: 1, message: "msg1" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);

      await queue.unsubscribe();

      await queue.publish({ id: 2, message: "msg2" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
    });

    it("should handle rapid publishing", async () => {
      const messages: TestPayload[] = [];
      const queue = memoryQueue<TestPayload>("rapid-test");

      await queue.subscribe(async (payload) => {
        messages.push(payload);
      });

      const publishPromises = [];
      for (let i = 1; i <= 10; i++) {
        publishPromises.push(queue.publish({ id: i, message: `msg-${i}` }));
      }

      await Promise.all(publishPromises);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(10);
      const ids = messages.map((m) => m.id);
      expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("should work with decorator pattern", async () => {
      const messages: TestPayload[] = [];
      const queue = memoryQueue<TestPayload>("decorator-test");

      class TestHandler {
        async handle(payload: TestPayload) {
          messages.push(payload);
        }
      }

      const handler = new TestHandler();
      await queue.subscribe(handler.handle.bind(handler));

      await queue.publish({ id: 1, message: "decorator" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe("decorator");
    });
  });
});
