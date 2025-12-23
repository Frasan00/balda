import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueueManager } from "../../src/queue/queue.js";
import { QueueService } from "../../src/queue/queue_service.js";
import type {
  GenericPubSub,
  PublishOptions,
} from "../../src/queue/queue_types.js";
import { CustomTypedQueue, TypedQueue } from "../../src/queue/typed_queue.js";

describe("TypedQueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  type TestPayload = { message: string; count: number };

  describe("publish", () => {
    it("should publish message using standard publish method", async () => {
      const mockPublish = vi.fn().mockResolvedValue({ id: "test-id-123" });
      const mockProvider = {
        publish: mockPublish,
        subscribe: vi.fn(),
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );
      const result = await queue.publish({ message: "hello", count: 1 });

      expect(result).toEqual({ id: "test-id-123" });
      expect(mockPublish).toHaveBeenCalledWith(
        "test-topic",
        { message: "hello", count: 1 },
        {},
      );
    });

    it("should publish message with options", async () => {
      const mockPublish = vi.fn().mockResolvedValue({ id: "test-id-456" });
      const mockProvider = {
        publish: mockPublish,
        subscribe: vi.fn(),
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );
      const options: PublishOptions<"bullmq"> = { delay: 1000, priority: 5 };
      await queue.publish({ message: "delayed", count: 2 }, options);

      expect(mockPublish).toHaveBeenCalledWith(
        "test-topic",
        { message: "delayed", count: 2 },
        options,
      );
    });

    it("should use publishWithConfig when queueOptions provided", async () => {
      const mockPublishWithConfig = vi
        .fn()
        .mockResolvedValue({ id: "config-id-789" });
      const mockProvider = {
        publishWithConfig: mockPublishWithConfig,
        subscribe: vi.fn(),
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const queueOptions = { connection: { host: "localhost", port: 6379 } };
      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
        queueOptions,
      );

      await queue.publish({ message: "configured", count: 3 });

      expect(mockPublishWithConfig).toHaveBeenCalledWith(
        "test-topic",
        { message: "configured", count: 3 },
        undefined,
        queueOptions,
      );
    });
  });

  describe("subscribe as decorator", () => {
    beforeEach(() => {
      QueueService.typedQueueSubscribers.clear();
      QueueService.instanceFactory = (ctor) => new (ctor as new () => object)();
    });

    it("should register decorated method as queue handler", () => {
      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );

      class TestHandler {
        @queue.subscribe()
        async handle(_payload: TestPayload) {
          return;
        }
      }

      const registrations = Array.from(
        QueueService.typedQueueSubscribers.values(),
      );
      expect(registrations.length).toBe(1);
      expect(registrations[0].name).toBe("TestHandler.handle");
      expect(registrations[0].topic).toBe("test-topic");
      expect(registrations[0].provider).toBe("bullmq");
    });

    it("should execute handler method on decorated class", async () => {
      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );
      const handlerSpy = vi.fn();

      class TestHandler {
        @queue.subscribe()
        async handle(payload: TestPayload) {
          handlerSpy(payload);
        }
      }

      const registrations = Array.from(
        QueueService.typedQueueSubscribers.values(),
      );
      expect(registrations.length).toBe(1);

      const handler = registrations[0].handler;
      const testPayload = { message: "test", count: 42 };
      await handler(testPayload);

      expect(handlerSpy).toHaveBeenCalledWith(testPayload);
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it("should use instance cache for decorated handlers", async () => {
      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );
      const constructorSpy = vi.fn();

      class TestHandler {
        constructor() {
          constructorSpy();
        }

        @queue.subscribe()
        async handle(_payload: TestPayload) {
          return;
        }
      }

      const registrations = Array.from(
        QueueService.typedQueueSubscribers.values(),
      );
      const handler = registrations[0].handler;

      await handler({ message: "first", count: 1 });
      await handler({ message: "second", count: 2 });
      await handler({ message: "third", count: 3 });

      expect(constructorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe with callback", () => {
    it("should subscribe using callback handler", async () => {
      const mockSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockProvider = {
        publish: vi.fn(),
        subscribe: mockSubscribe,
        unsubscribe: vi.fn(),
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
      );
      const handler = async (payload: TestPayload) => {
        console.log(payload);
      };

      await queue.subscribe(handler);

      expect(mockSubscribe).toHaveBeenCalledWith("test-topic", handler);
    });

    it("should use subscribeWithConfig when queueOptions provided", async () => {
      const mockSubscribeWithConfig = vi.fn().mockResolvedValue(undefined);
      const mockProvider = {
        publish: vi.fn(),
        subscribeWithConfig: mockSubscribeWithConfig,
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const queueOptions = { connection: { host: "localhost", port: 6379 } };
      const queue = new TypedQueue<TestPayload, "bullmq">(
        "test-topic",
        "bullmq",
        queueOptions,
      );

      const handler = async (_payload: TestPayload) => {
        return;
      };

      await queue.subscribe(handler);

      expect(mockSubscribeWithConfig).toHaveBeenCalledWith(
        "test-topic",
        handler,
        queueOptions,
      );
    });
  });

  describe("properties", () => {
    it("should expose topic and provider properties", () => {
      const queue = new TypedQueue<TestPayload, "sqs">("my-topic", "sqs");
      expect(queue.topic).toBe("my-topic");
      expect(queue.provider).toBe("sqs");
    });
  });
});

describe("CustomTypedQueue", () => {
  type TestPayload = { data: string };

  describe("publish", () => {
    it("should publish using custom pubsub implementation", async () => {
      const mockPublish = vi.fn().mockResolvedValue({ id: "custom-id-123" });
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: mockPublish,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "custom-topic",
        mockPubSub,
      );
      const result = await queue.publish({ data: "test" });

      expect(result).toEqual({ id: "custom-id-123" });
      expect(mockPublish).toHaveBeenCalledWith(
        "custom-topic",
        { data: "test" },
        undefined,
      );
    });

    it("should publish with custom options", async () => {
      const mockPublish = vi.fn().mockResolvedValue({ id: "custom-id-456" });
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: mockPublish,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload, { priority: number }>(
        "custom-topic",
        mockPubSub,
      );
      await queue.publish({ data: "priority" }, { priority: 10 });

      expect(mockPublish).toHaveBeenCalledWith(
        "custom-topic",
        { data: "priority" },
        { priority: 10 },
      );
    });
  });

  describe("subscribe as decorator", () => {
    beforeEach(() => {
      QueueService.customQueueSubscribers.clear();
      QueueService.instanceFactory = (ctor) => new (ctor as new () => object)();
    });

    it("should register decorated method as custom queue handler", () => {
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "custom-topic",
        mockPubSub,
      );

      class CustomHandler {
        @queue.subscribe()
        async handle(_payload: TestPayload) {
          return;
        }
      }

      const registrations = Array.from(
        QueueService.customQueueSubscribers.values(),
      );
      expect(registrations.length).toBe(1);
      expect(registrations[0].name).toBe("CustomHandler.handle");
      expect(registrations[0].topic).toBe("custom-topic");
      expect(registrations[0].pubsub).toBe(mockPubSub);
    });

    it("should execute handler on custom queue", async () => {
      const handlerSpy = vi.fn();
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "custom-topic",
        mockPubSub,
      );

      class CustomHandler {
        @queue.subscribe()
        async handle(payload: TestPayload) {
          handlerSpy(payload);
        }
      }

      const registrations = Array.from(
        QueueService.customQueueSubscribers.values(),
      );
      const handler = registrations[0].handler;

      await handler({ data: "custom test" });

      expect(handlerSpy).toHaveBeenCalledWith({ data: "custom test" });
    });

    it("should use instance cache for custom queue handlers", async () => {
      const constructorSpy = vi.fn();
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "custom-topic",
        mockPubSub,
      );

      class CustomHandler {
        constructor() {
          constructorSpy();
        }

        @queue.subscribe()
        async handle(_payload: TestPayload) {
          return;
        }
      }

      const registrations = Array.from(
        QueueService.customQueueSubscribers.values(),
      );
      const handler = registrations[0].handler;

      await handler({ data: "first" });
      await handler({ data: "second" });
      await handler({ data: "third" });

      expect(constructorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe with callback", () => {
    it("should subscribe using callback handler", async () => {
      const mockSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: vi.fn(),
        subscribe: mockSubscribe,
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "custom-topic",
        mockPubSub,
      );
      const handler = async (_payload: TestPayload) => {
        return;
      };

      await queue.subscribe(handler);

      expect(mockSubscribe).toHaveBeenCalledWith("custom-topic", handler);
    });
  });

  describe("properties", () => {
    it("should expose topic property", () => {
      const mockPubSub: GenericPubSub<TestPayload> = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const queue = new CustomTypedQueue<TestPayload>(
        "my-custom-topic",
        mockPubSub,
      );
      expect(queue.topic).toBe("my-custom-topic");
    });
  });
});
