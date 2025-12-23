import { QueueOptions } from "bullmq";
import { describe, expect, it } from "vitest";
import {
  bullmqQueue,
  createQueue,
  memoryQueue,
  pgbossQueue,
  sqsQueue,
} from "../../src/queue/factories.js";
import type { GenericPubSub } from "../../src/queue/queue_types.js";
import { CustomTypedQueue, TypedQueue } from "../../src/queue/typed_queue.js";

describe("Queue Factories", () => {
  type TestPayload = { id: number; name: string };

  describe("sqsQueue", () => {
    it("should create a TypedQueue for SQS provider", () => {
      const queue = sqsQueue<TestPayload>("test-sqs-topic");

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-sqs-topic");
      expect(queue.provider).toBe("sqs");
    });

    it("should create SQS queue with options", () => {
      const options = {
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
      };

      const queue = sqsQueue<TestPayload>("test-sqs-topic", options);

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-sqs-topic");
      expect(queue.provider).toBe("sqs");
    });

    it("should handle typed payloads correctly", () => {
      const queue = sqsQueue<TestPayload>("typed-sqs");

      expect(queue.topic).toBe("typed-sqs");
    });
  });

  describe("bullmqQueue", () => {
    it("should create a TypedQueue for BullMQ provider", () => {
      const queue = bullmqQueue<TestPayload>("test-bullmq-topic");

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-bullmq-topic");
      expect(queue.provider).toBe("bullmq");
    });

    it("should create BullMQ queue with connection options", () => {
      const options = {
        connection: {
          host: "localhost",
          port: 6379,
          password: "secret",
        },
      };

      const queue = bullmqQueue<TestPayload>("test-bullmq-topic", options);

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-bullmq-topic");
      expect(queue.provider).toBe("bullmq");
    });

    it("should create BullMQ queue with job options", () => {
      const options = {
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 10,
          attempts: 3,
        },
      };

      const queue = bullmqQueue<TestPayload>("jobs", options as QueueOptions);

      expect(queue.topic).toBe("jobs");
    });
  });

  describe("pgbossQueue", () => {
    it("should create a TypedQueue for PGBoss provider", () => {
      const queue = pgbossQueue<TestPayload>("test-pgboss-topic");

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-pgboss-topic");
      expect(queue.provider).toBe("pgboss");
    });

    it("should create PGBoss queue with connection string", () => {
      const options = {
        connectionString: "postgres://user:pass@localhost:5432/db",
      };

      const queue = pgbossQueue<TestPayload>("test-pgboss-topic", options);

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-pgboss-topic");
      expect(queue.provider).toBe("pgboss");
    });
  });

  describe("memoryQueue", () => {
    it("should create a TypedQueue for Memory provider", () => {
      const queue = memoryQueue<TestPayload>("test-memory-topic");

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("test-memory-topic");
      expect(queue.provider).toBe("memory");
    });

    it("should handle typed payloads correctly", () => {
      const queue = memoryQueue<TestPayload>("typed-memory");

      expect(queue.topic).toBe("typed-memory");
      expect(queue.provider).toBe("memory");
    });

    it("should create memory queue for immediate processing", () => {
      type EmailPayload = { to: string; subject: string; body: string };
      const queue = memoryQueue<EmailPayload>("email-queue");

      expect(queue).toBeInstanceOf(TypedQueue);
      expect(queue.topic).toBe("email-queue");
      expect(queue.provider).toBe("memory");
    });
  });

  describe("createQueue", () => {
    it("should create a CustomTypedQueue with custom pubsub", () => {
      const mockPubSub: GenericPubSub<TestPayload> = {
        async publish(topic, _payload) {
          return { id: `custom-${topic}` };
        },
        async subscribe(_topic, _handler) {},
        async unsubscribe(_topic) {},
      };

      const queue = createQueue<TestPayload>("custom-topic", mockPubSub);

      expect(queue).toBeInstanceOf(CustomTypedQueue);
      expect(queue.topic).toBe("custom-topic");
    });

    it("should create custom queue with typed options", () => {
      type CustomOptions = { priority: number; retries: number };

      const mockPubSub: GenericPubSub<TestPayload> = {
        async publish() {
          return { id: "custom-id" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      const queue = createQueue<TestPayload, CustomOptions>(
        "custom-topic",
        mockPubSub,
      );

      expect(queue.topic).toBe("custom-topic");
    });

    it("should work with in-memory pubsub implementation", () => {
      class InMemoryPubSub implements GenericPubSub<TestPayload> {
        private handlers = new Map<
          string,
          Array<(payload: TestPayload) => Promise<void>>
        >();

        async publish(topic: string, payload: TestPayload) {
          const handlers = this.handlers.get(topic) || [];
          await Promise.all(handlers.map((h) => h(payload)));
          return { id: `memory-${Date.now()}` };
        }

        async subscribe(
          topic: string,
          handler: (payload: TestPayload) => Promise<void>,
        ): Promise<void> {
          const handlers = this.handlers.get(topic) || [];
          handlers.push(handler);
          this.handlers.set(topic, handlers);
        }

        async unsubscribe(topic: string): Promise<void> {
          this.handlers.delete(topic);
        }
      }

      const pubsub = new InMemoryPubSub();
      const queue = createQueue<TestPayload>("memory-topic", pubsub);

      expect(queue).toBeInstanceOf(CustomTypedQueue);
      expect(queue.topic).toBe("memory-topic");
    });
  });

  describe("factory type safety", () => {
    it("should enforce payload types for SQS", () => {
      type UserPayload = { userId: string; email: string };
      const queue = sqsQueue<UserPayload>("users");

      expect(queue.topic).toBe("users");
    });

    it("should enforce payload types for BullMQ", () => {
      type OrderPayload = { orderId: number; total: number };
      const queue = bullmqQueue<OrderPayload>("orders");

      expect(queue.topic).toBe("orders");
    });

    it("should enforce payload types for PGBoss", () => {
      type EmailPayload = { to: string; subject: string; body: string };
      const queue = pgbossQueue<EmailPayload>("emails");

      expect(queue.topic).toBe("emails");
    });

    it("should enforce payload types for Memory", () => {
      type TaskPayload = { taskId: string; action: string };
      const queue = memoryQueue<TaskPayload>("tasks");

      expect(queue.topic).toBe("tasks");
    });

    it("should enforce payload types for custom queues", () => {
      type NotificationPayload = { userId: string; message: string };
      const mockPubSub: GenericPubSub<NotificationPayload> = {
        async publish() {
          return { id: "notif-id" };
        },
        async subscribe() {},
        async unsubscribe() {},
      };

      const queue = createQueue<NotificationPayload>(
        "notifications",
        mockPubSub,
      );

      expect(queue.topic).toBe("notifications");
    });
  });
});
