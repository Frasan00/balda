import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueueManager } from "../../src/queue/queue.js";
import { defineQueueConfiguration } from "../../src/queue/queue_config.js";
import type { GenericPubSub } from "../../src/queue/queue_types.js";

// Extend module to allow custom queue provider keys in tests
declare module "../../src/queue/queue_types.js" {
  interface QueueProvider {
    custom?: GenericPubSub;
    redis?: GenericPubSub;
    kafka?: GenericPubSub;
  }
}

describe("defineQueueConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    QueueManager.map.delete("custom" as any);
    QueueManager.map.delete("redis" as any);
    QueueManager.map.delete("kafka" as any);
    QueueManager.map.delete("non-existent" as any);
  });

  afterEach(() => {
    QueueManager.map.delete("custom" as any);
    QueueManager.map.delete("redis" as any);
    QueueManager.map.delete("kafka" as any);
    QueueManager.map.delete("non-existent" as any);
  });

  describe("BullMQ configuration", () => {
    it("should configure BullMQ with connection options", () => {
      defineQueueConfiguration({
        bullmq: {
          connection: {
            host: "localhost",
            port: 6379,
            password: "secret",
            db: 1,
          },
        },
      });

      const provider = QueueManager.getProvider("bullmq");
      expect(provider).toBeDefined();
    });

    it("should configure BullMQ with default job options", () => {
      defineQueueConfiguration({
        bullmq: {
          connection: { host: "localhost" },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 1000,
            },
          },
        },
      });

      const provider = QueueManager.getProvider("bullmq");
      expect(provider).toBeDefined();
    });

    it("should configure BullMQ with error handler", () => {
      const errorHandler = vi.fn();

      defineQueueConfiguration({
        bullmq: {
          connection: { host: "localhost" },
          errorHandler,
        },
      });

      const provider = QueueManager.getProvider("bullmq");
      expect(provider).toBeDefined();
    });
  });

  describe("SQS configuration", () => {
    it("should configure SQS with client options", () => {
      defineQueueConfiguration({
        sqs: {
          client: {
            region: "us-east-1",
            endpoint: "http://localhost:9324",
          },
        },
      });

      const provider = QueueManager.getProvider("sqs");
      expect(provider).toBeDefined();
    });

    it("should configure SQS with consumer options", () => {
      defineQueueConfiguration({
        sqs: {
          client: {
            region: "us-west-2",
          },
          consumer: {
            queueUrlMap: {
              orders: "https://sqs.us-west-2.amazonaws.com/123456789/orders",
              users: "https://sqs.us-west-2.amazonaws.com/123456789/users",
            },
          },
        },
      });

      const provider = QueueManager.getProvider("sqs");
      expect(provider).toBeDefined();
    });

    it("should configure SQS with credentials", () => {
      defineQueueConfiguration({
        sqs: {
          client: {
            region: "eu-west-1",
            credentials: {
              accessKeyId: "test-key-id",
              secretAccessKey: "test-secret",
            },
          },
        },
      });

      const provider = QueueManager.getProvider("sqs");
      expect(provider).toBeDefined();
    });
  });

  describe("PGBoss configuration", () => {
    it("should configure PGBoss with connection string", () => {
      defineQueueConfiguration({
        pgboss: {
          connectionString: "postgres://user:pass@localhost:5432/database",
        },
      });

      const provider = QueueManager.getProvider("pgboss");
      expect(provider).toBeDefined();
    });

    it("should configure PGBoss with empty options", () => {
      defineQueueConfiguration({
        pgboss: {},
      });

      const provider = QueueManager.getProvider("pgboss");
      expect(provider).toBeDefined();
    });
  });

  describe("custom provider configuration", () => {
    it("should register a single custom provider", () => {
      const mockPubSub: GenericPubSub = {
        async publish(topic, _payload) {
          return { id: `custom-${topic}` };
        },
        async subscribe(_topic, _handler) {},
        async unsubscribe(_topic) {},
      };

      defineQueueConfiguration({
        custom: mockPubSub as any,
      });

      const provider = QueueManager.getProvider("custom" as any);
      expect(provider).toBe(mockPubSub);
    });

    it("should register multiple custom providers", () => {
      const redisPubSub: GenericPubSub = {
        async publish() {
          return { id: "redis-id" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      const kafkaPubSub: GenericPubSub = {
        async publish() {
          return { id: "kafka-id" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      defineQueueConfiguration({
        redis: redisPubSub as any,
        kafka: kafkaPubSub as any,
      });

      const redisProvider = QueueManager.getProvider("redis" as any);
      const kafkaProvider = QueueManager.getProvider("kafka" as any);

      expect(redisProvider).toBe(redisPubSub);
      expect(kafkaProvider).toBe(kafkaPubSub);
    });
  });

  describe("mixed configuration", () => {
    it("should configure both built-in and custom providers", () => {
      const customPubSub: GenericPubSub = {
        async publish() {
          return { id: "custom" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      defineQueueConfiguration({
        bullmq: {
          connection: { host: "localhost", port: 6379 },
        },
        sqs: {
          client: { region: "us-east-1" },
        },
        pgboss: {
          connectionString: "postgres://localhost/db",
        },
        custom: customPubSub as any,
      });

      expect(QueueManager.getProvider("bullmq")).toBeDefined();
      expect(QueueManager.getProvider("sqs")).toBeDefined();
      expect(QueueManager.getProvider("pgboss")).toBeDefined();
      expect(QueueManager.getProvider("custom" as any)).toBe(customPubSub);
    });

    it("should handle empty configuration object", () => {
      defineQueueConfiguration({});

      expect(QueueManager.getProvider("bullmq")).toBeDefined();
      expect(QueueManager.getProvider("sqs")).toBeDefined();
      expect(QueueManager.getProvider("pgboss")).toBeDefined();
    });
  });

  describe("reconfiguration", () => {
    it("should allow multiple configuration calls", () => {
      defineQueueConfiguration({
        bullmq: {
          connection: { host: "localhost", port: 6379 },
        },
      });

      defineQueueConfiguration({
        sqs: {
          client: { region: "us-west-2" },
        },
      });

      expect(QueueManager.getProvider("bullmq")).toBeDefined();
      expect(QueueManager.getProvider("sqs")).toBeDefined();
    });

    it("should override custom providers on reconfiguration", () => {
      const firstPubSub: GenericPubSub = {
        async publish() {
          return { id: "first" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      const secondPubSub: GenericPubSub = {
        async publish() {
          return { id: "second" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      defineQueueConfiguration({
        custom: firstPubSub as any,
      });

      defineQueueConfiguration({
        custom: secondPubSub as any,
      });

      const provider = QueueManager.getProvider("custom" as any);
      expect(provider).toBe(secondPubSub);
      expect(provider).not.toBe(firstPubSub);
    });
  });
});
