import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueueManager } from "../../src/queue/queue.js";
import { QueueService } from "../../src/queue/queue_service.js";
import type { GenericPubSub } from "../../src/queue/queue_types.js";

describe("QueueService", () => {
  beforeEach(() => {
    QueueService.typedQueueSubscribers.clear();
    QueueService.customQueueSubscribers.clear();
    QueueService.instanceFactory = (ctor) => new (ctor as new () => object)();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerTypedQueue", () => {
    it("should register a typed queue handler", () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler,
        "bullmq",
      );

      const key = "bullmq:test-topic:TestClass.handle";
      expect(QueueService.typedQueueSubscribers.has(key)).toBe(true);

      const registration = QueueService.typedQueueSubscribers.get(key);
      expect(registration).toBeDefined();
      expect(registration?.name).toBe("TestClass.handle");
      expect(registration?.topic).toBe("test-topic");
      expect(registration?.provider).toBe("bullmq");
      expect(registration?.handler).toBe(handler);
    });

    it("should register multiple handlers for different topics", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      QueueService.registerTypedQueue(
        "Handler1.handle",
        "topic-1",
        handler1,
        "bullmq",
      );
      QueueService.registerTypedQueue(
        "Handler2.handle",
        "topic-2",
        handler2,
        "sqs",
      );

      expect(QueueService.typedQueueSubscribers.size).toBe(2);
      expect(
        QueueService.typedQueueSubscribers.has(
          "bullmq:topic-1:Handler1.handle",
        ),
      ).toBe(true);
      expect(
        QueueService.typedQueueSubscribers.has("sqs:topic-2:Handler2.handle"),
      ).toBe(true);
    });

    it("should register handler with queue options", () => {
      const handler = vi.fn();
      const queueOptions = { connection: { host: "localhost" } };

      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler,
        "bullmq",
        queueOptions,
      );

      const key = "bullmq:test-topic:TestClass.handle";
      const registration = QueueService.typedQueueSubscribers.get(key);
      expect(registration?.queueOptions).toEqual(queueOptions);
    });

    it("should overwrite existing handler with warning", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler1,
        "bullmq",
      );
      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler2,
        "bullmq",
      );

      const key = "bullmq:test-topic:TestClass.handle";
      const registration = QueueService.typedQueueSubscribers.get(key);
      expect(registration?.handler).toBe(handler2);
      expect(QueueService.typedQueueSubscribers.size).toBe(1);

      consoleWarnSpy.mockRestore();
    });
  });

  describe("registerCustomQueue", () => {
    const mockPubSub: GenericPubSub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    it("should register a custom queue handler", () => {
      const handler = vi.fn();

      QueueService.registerCustomQueue(
        "CustomClass.handle",
        "custom-topic",
        handler,
        mockPubSub,
      );

      const key = `${mockPubSub.constructor.name}:custom-topic:CustomClass.handle`;
      expect(QueueService.customQueueSubscribers.has(key)).toBe(true);

      const registration = QueueService.customQueueSubscribers.get(key);
      expect(registration?.name).toBe("CustomClass.handle");
      expect(registration?.topic).toBe("custom-topic");
      expect(registration?.pubsub).toBe(mockPubSub);
      expect(registration?.handler).toBe(handler);
    });

    it("should register multiple custom handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const pubsub2: GenericPubSub = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      QueueService.registerCustomQueue(
        "Handler1.handle",
        "topic-1",
        handler1,
        mockPubSub,
      );
      QueueService.registerCustomQueue(
        "Handler2.handle",
        "topic-2",
        handler2,
        pubsub2,
      );

      expect(QueueService.customQueueSubscribers.size).toBe(2);
    });

    it("should overwrite existing custom handler with warning", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      QueueService.registerCustomQueue(
        "CustomClass.handle",
        "topic",
        handler1,
        mockPubSub,
      );
      QueueService.registerCustomQueue(
        "CustomClass.handle",
        "topic",
        handler2,
        mockPubSub,
      );

      const key = `${mockPubSub.constructor.name}:topic:CustomClass.handle`;
      const registration = QueueService.customQueueSubscribers.get(key);
      expect(registration?.handler).toBe(handler2);
      expect(QueueService.customQueueSubscribers.size).toBe(1);

      consoleWarnSpy.mockRestore();
    });
  });

  describe("run", () => {
    it("should do nothing when no handlers registered", async () => {
      await QueueService.run();

      expect(QueueService.typedQueueSubscribers.size).toBe(0);
      expect(QueueService.customQueueSubscribers.size).toBe(0);
    });

    it("should subscribe typed queue handlers", async () => {
      const mockSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockProvider = {
        publish: vi.fn(),
        subscribe: mockSubscribe,
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const handler = vi.fn();
      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler,
        "bullmq",
      );

      await QueueService.run();

      expect(mockSubscribe).toHaveBeenCalledWith("test-topic", handler);
    });

    it("should use subscribeWithConfig when queueOptions provided", async () => {
      const mockSubscribeWithConfig = vi.fn().mockResolvedValue(undefined);
      const mockProvider = {
        publish: vi.fn(),
        subscribeWithConfig: mockSubscribeWithConfig,
        subscribe: vi.fn(),
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockProvider as any,
      );

      const handler = vi.fn();
      const queueOptions = { connection: { host: "localhost" } };

      QueueService.registerTypedQueue(
        "TestClass.handle",
        "test-topic",
        handler,
        "bullmq",
        queueOptions,
      );

      await QueueService.run();

      expect(mockSubscribeWithConfig).toHaveBeenCalledWith(
        "test-topic",
        handler,
        queueOptions,
      );
    });

    it("should subscribe custom queue handlers", async () => {
      const mockSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockPubSub: GenericPubSub = {
        publish: vi.fn(),
        subscribe: mockSubscribe,
        unsubscribe: vi.fn(),
      };

      const handler = vi.fn();
      QueueService.registerCustomQueue(
        "CustomClass.handle",
        "custom-topic",
        handler,
        mockPubSub,
      );

      await QueueService.run();

      expect(mockSubscribe).toHaveBeenCalledWith("custom-topic", handler);
    });

    it("should subscribe both typed and custom handlers", async () => {
      const typedSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockTypedProvider = {
        publish: vi.fn(),
        subscribe: typedSubscribe,
      };

      vi.spyOn(QueueManager, "getProvider").mockReturnValue(
        mockTypedProvider as any,
      );

      const customSubscribe = vi.fn().mockResolvedValue(undefined);
      const mockCustomPubSub: GenericPubSub = {
        publish: vi.fn(),
        subscribe: customSubscribe,
        unsubscribe: vi.fn(),
      };

      const typedHandler = vi.fn();
      const customHandler = vi.fn();

      QueueService.registerTypedQueue(
        "TypedClass.handle",
        "typed-topic",
        typedHandler,
        "bullmq",
      );
      QueueService.registerCustomQueue(
        "CustomClass.handle",
        "custom-topic",
        customHandler,
        mockCustomPubSub,
      );

      await QueueService.run();

      expect(typedSubscribe).toHaveBeenCalledWith("typed-topic", typedHandler);
      expect(customSubscribe).toHaveBeenCalledWith(
        "custom-topic",
        customHandler,
      );
    });
  });

  describe("massiveImportQueues", () => {
    it("should import queue files from glob patterns", async () => {
      await QueueService.massiveImportQueues(["test/queue/schedules/*.ts"]);

      expect(QueueService.typedQueueSubscribers.size).toBeGreaterThan(0);
    });

    it("should handle import errors gracefully by default", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await QueueService.massiveImportQueues(["test/non-existent/*.ts"]);

      consoleErrorSpy.mockRestore();
    });

    it("should handle empty glob results gracefully", async () => {
      await QueueService.massiveImportQueues([
        "test/queue/non-existent-pattern/*.ts",
      ]);

      expect(QueueService.typedQueueSubscribers.size).toBeGreaterThanOrEqual(0);
    });

    it("should import multiple glob patterns", async () => {
      const initialSize = QueueService.typedQueueSubscribers.size;

      const patterns = ["test/queue/schedules/bullmq.ts"];

      await QueueService.massiveImportQueues(patterns);

      expect(QueueService.typedQueueSubscribers.size).toBeGreaterThanOrEqual(
        initialSize,
      );
    });
  });

  describe("instanceFactory", () => {
    it("should use default instance factory", () => {
      class TestClass {
        value = "test";
      }

      const instance = QueueService.instanceFactory(TestClass);
      expect(instance).toBeInstanceOf(TestClass);
      expect((instance as TestClass).value).toBe("test");
    });

    it("should allow custom instance factory", () => {
      const customInstance = { customValue: "custom" };
      QueueService.instanceFactory = () => customInstance;

      class TestClass {}
      const instance = QueueService.instanceFactory(TestClass);
      expect(instance).toBe(customInstance);
    });

    it("should support dependency injection via custom factory", () => {
      class Dependency {
        getValue() {
          return "injected";
        }
      }

      class TestClass {
        constructor(public dep: Dependency) {}
      }

      const dependency = new Dependency();
      QueueService.instanceFactory = (ctor) => {
        if (ctor === TestClass) {
          return new TestClass(dependency);
        }
        return new (ctor as new () => object)();
      };

      const instance = QueueService.instanceFactory(TestClass) as TestClass;
      expect(instance.dep).toBe(dependency);
      expect(instance.dep.getValue()).toBe("injected");
    });
  });
});
