import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueueManager } from "../../src/queue/queue.js";
import type {
  GenericPubSub,
  QueueProviderKey,
} from "../../src/queue/queue_types.js";

describe("QueueManager", () => {
  afterEach(() => {
    QueueManager.map.delete("custom" as QueueProviderKey);
    QueueManager.map.delete("non-existent" as QueueProviderKey);
  });
  describe("getProvider", () => {
    it("should return built-in bullmq provider", () => {
      const provider = QueueManager.getProvider("bullmq");
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty("publish");
      expect(provider).toHaveProperty("subscribe");
    });

    it("should return built-in sqs provider", () => {
      const provider = QueueManager.getProvider("sqs");
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty("publish");
      expect(provider).toHaveProperty("subscribe");
    });

    it("should return built-in pgboss provider", () => {
      const provider = QueueManager.getProvider("pgboss");
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty("publish");
      expect(provider).toHaveProperty("subscribe");
    });

    it("should throw error for non-existent provider", () => {
      expect(() => {
        QueueManager.getProvider("non-existent" as QueueProviderKey);
      }).toThrow("[QueueSubscriber] Provider non-existent not found");
    });
  });

  describe("setProvider", () => {
    let mockPubSub: GenericPubSub;

    beforeEach(() => {
      QueueManager.map.delete("custom" as QueueProviderKey);
      QueueManager.map.delete("non-existent" as QueueProviderKey);

      mockPubSub = {
        async publish(topic: string, payload: unknown) {
          return { id: `custom-${topic}-${JSON.stringify(payload)}` };
        },
        async subscribe(
          _topic: string,
          _handler: (payload: unknown) => Promise<void>,
        ) {
          return Promise.resolve();
        },
        async unsubscribe(_topic: string) {
          return Promise.resolve();
        },
      };
    });

    it("should register a custom provider", () => {
      QueueManager.setProvider(
        "custom" as QueueProviderKey,
        mockPubSub as GenericPubSub<QueueProviderKey>,
      );
      const provider = QueueManager.getProvider("custom" as QueueProviderKey);
      expect(provider).toBe(mockPubSub);
    });

    it("should override existing provider", () => {
      const firstProvider = mockPubSub;
      const secondProvider: GenericPubSub = {
        async publish() {
          return { id: "second" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      QueueManager.setProvider(
        "custom" as QueueProviderKey,
        firstProvider as GenericPubSub<QueueProviderKey>,
      );
      QueueManager.setProvider(
        "custom" as QueueProviderKey,
        secondProvider as GenericPubSub<QueueProviderKey>,
      );

      const provider = QueueManager.getProvider("custom" as QueueProviderKey);
      expect(provider).toBe(secondProvider);
      expect(provider).not.toBe(firstProvider);
    });
  });

  describe("static initialization", () => {
    it("should have all built-in providers initialized", () => {
      expect(QueueManager.map.has("bullmq")).toBe(true);
      expect(QueueManager.map.has("sqs")).toBe(true);
      expect(QueueManager.map.has("pgboss")).toBe(true);
    });

    it("should have map with correct size for built-in providers", () => {
      expect(QueueManager.map.size).toBeGreaterThanOrEqual(3);
    });
  });
});
