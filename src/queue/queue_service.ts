import { glob } from "glob";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { QueueManager } from "./queue.js";
import type { BuiltInProviderKey, GenericPubSub } from "./queue_types.js";

type QueueHandler = (payload: unknown) => Promise<void>;

// Built-in provider queue registration
type TypedQueueRegistration = {
  name: string;
  topic: string;
  handler: QueueHandler;
  provider: BuiltInProviderKey;
  queueOptions?: unknown;
};

// Custom provider queue registration
type CustomQueueRegistration = {
  name: string;
  topic: string;
  handler: QueueHandler;
  pubsub: GenericPubSub;
};

export class QueueService {
  static typedQueueSubscribers: Map<string, TypedQueueRegistration> = new Map();
  static customQueueSubscribers: Map<string, CustomQueueRegistration> =
    new Map();

  private static readonly logger = logger.child({ scope: "QueueService" });

  /**
   * Factory function for creating handler instances.
   * Can be overridden to provide custom dependency injection.
   * @default Creates new instance using constructor
   */
  static instanceFactory: (ctor: Function) => object = (ctor) =>
    new (ctor as new () => object)();

  static registerTypedQueue(
    name: string,
    topic: string,
    handler: QueueHandler,
    provider: BuiltInProviderKey,
    queueOptions?: unknown,
  ): void {
    const key = `${provider}:${topic}:${name}`;
    if (this.typedQueueSubscribers.has(key)) {
      this.logger.warn(
        `Queue handler for ${key} already registered, overwriting previous handler`,
      );
    }

    this.typedQueueSubscribers.set(key, {
      name,
      topic,
      handler,
      provider,
      queueOptions,
    });
  }

  static registerCustomQueue(
    name: string,
    topic: string,
    handler: QueueHandler,
    pubsub: GenericPubSub,
  ): void {
    const key = `${pubsub.constructor.name}:${topic}:${name}`;
    if (this.customQueueSubscribers.has(key)) {
      this.logger.warn(
        `Custom queue handler for ${key} already registered, overwriting previous handler`,
      );
    }

    this.customQueueSubscribers.set(key, {
      name,
      topic,
      handler,
      pubsub,
    });
  }

  static async run() {
    this.logger.info("Subscribing queue handlers");
    const hasTyped = this.typedQueueSubscribers.size > 0;
    const hasCustom = this.customQueueSubscribers.size > 0;

    if (!hasTyped && !hasCustom) {
      this.logger.info("No queue handlers to subscribe");
      return;
    }

    // Subscribe typed queue handlers (built-in providers)
    for (const registration of this.typedQueueSubscribers.values()) {
      const { topic, handler, provider, queueOptions } = registration;
      this.logger.info(`Subscribing to queue: ${topic}`);

      const pubsub = QueueManager.getProvider(provider);

      // Use subscribeWithConfig if queueOptions are provided
      if (
        queueOptions &&
        "subscribeWithConfig" in pubsub &&
        typeof pubsub.subscribeWithConfig === "function"
      ) {
        await pubsub.subscribeWithConfig(topic, handler, queueOptions);
      } else {
        await (
          pubsub as typeof pubsub & {
            subscribe(
              topic: string,
              handler: (payload: unknown) => Promise<void>,
            ): Promise<void>;
          }
        ).subscribe(topic, handler);
      }
    }

    // Subscribe custom queue handlers
    for (const {
      topic,
      handler,
      pubsub,
    } of this.customQueueSubscribers.values()) {
      this.logger.info(`Subscribing to custom queue: ${topic}`);
      await pubsub.subscribe(topic, handler);
    }

    this.logger.info("Queue handlers subscribed");
  }

  static async massiveImportQueues(
    queueHandlerPatterns: string[],
    options: { throwOnError?: boolean } = {},
  ) {
    const allFiles: string[] = [];

    for (const pattern of queueHandlerPatterns) {
      const files = await glob(pattern, {
        absolute: true,
        cwd: nativeCwd.getCwd(),
      });

      this.logger.info(`Pattern "${pattern}" matched ${files.length} file(s)`);
      allFiles.push(...files);
    }

    if (allFiles.length === 0) {
      this.logger.warn("No files matched the provided patterns");
      return;
    }

    this.logger.info(`Importing ${allFiles.length} queue handler file(s)`);

    await Promise.all(
      allFiles.map(async (file) => {
        this.logger.debug(`Importing: ${file}`);
        await import(file).catch((error) => {
          this.logger.error(`Error importing queue handler: ${file}`);
          this.logger.error(error);
          if (options.throwOnError) {
            throw error;
          }
        });
      }),
    );

    this.logger.info(`Successfully imported ${allFiles.length} file(s)`);
  }
}
