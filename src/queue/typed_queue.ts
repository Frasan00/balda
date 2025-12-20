import type { BullMQPubSub } from "./providers/bullmq/bullmq.js";
import type { PGBossPubSub } from "./providers/pgboss/pgboss.js";
import type { SQSPubSub } from "./providers/sqs/sqs.js";
import { QueueManager } from "./queue.js";
import { QueueService } from "./queue_service.js";
import type {
  BuiltInProviderKey,
  BullMQQueueOptions,
  GenericPubSub,
  PGBossQueueOptions,
  PublishOptions,
  SQSQueueOptions,
} from "./queue_types.js";

// Queue options mapped to provider
type QueueOptionsForProvider<P extends BuiltInProviderKey> = P extends "sqs"
  ? SQSQueueOptions
  : P extends "bullmq"
    ? BullMQQueueOptions
    : P extends "pgboss"
      ? PGBossQueueOptions
      : never;

// Provider instance mapped to key
type ProviderInstance<P extends BuiltInProviderKey> = P extends "sqs"
  ? SQSPubSub
  : P extends "bullmq"
    ? BullMQPubSub
    : P extends "pgboss"
      ? PGBossPubSub
      : never;

// Type for PubSub with publishWithConfig method
type PubSubWithPublishConfig<
  TProvider extends BuiltInProviderKey,
  TPayload,
> = ProviderInstance<TProvider> & {
  publishWithConfig: (
    topic: string,
    payload: TPayload,
    options: PublishOptions<TProvider> | undefined,
    queueConfig: QueueOptionsForProvider<TProvider>,
  ) => Promise<{ id: string }>;
};

// Type for PubSub with standard publish method
type PubSubWithPublish<
  TProvider extends BuiltInProviderKey,
  TPayload,
> = ProviderInstance<TProvider> & {
  publish: (
    topic: string,
    payload: TPayload,
    options: PublishOptions<TProvider>,
  ) => Promise<{ id: string }>;
};

// Type for PubSub with subscribeWithConfig method
type PubSubWithSubscribeConfig<
  TProvider extends BuiltInProviderKey,
  TPayload,
> = ProviderInstance<TProvider> & {
  subscribeWithConfig: (
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
    queueConfig: QueueOptionsForProvider<TProvider>,
  ) => Promise<void>;
};

// Type for PubSub with standard subscribe method
type PubSubWithSubscribe<
  TProvider extends BuiltInProviderKey,
  TPayload,
> = ProviderInstance<TProvider> & {
  subscribe: (
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ) => Promise<void>;
};

// Instance cache for decorator handlers to avoid creating new instances on every message
const instanceCache = new WeakMap<Function, object>();

/**
 * TypedQueue for built-in providers (sqs, bullmq, pgboss)
 */
export class TypedQueue<
  TPayload,
  TProvider extends BuiltInProviderKey = BuiltInProviderKey,
> {
  constructor(
    public readonly topic: string,
    public readonly provider: TProvider,
    private readonly queueOptions?: QueueOptionsForProvider<TProvider>,
  ) {}

  async publish(
    payload: TPayload,
    options?: PublishOptions<TProvider>,
  ): Promise<{ id: string }> {
    const pubsub = QueueManager.getProvider(
      this.provider,
    ) as ProviderInstance<TProvider>;

    if (this.queueOptions) {
      // Use publishWithConfig when queue-specific options are provided
      return (
        pubsub as PubSubWithPublishConfig<TProvider, TPayload>
      ).publishWithConfig(this.topic, payload, options, this.queueOptions);
    }

    // Default: use standard publish
    return (pubsub as PubSubWithPublish<TProvider, TPayload>).publish(
      this.topic,
      payload,
      (options ?? {}) as PublishOptions<TProvider>,
    );
  }

  /**
   * Subscribe to the queue, to be used as a decorator on a class method
   * @example
   * ```ts
   * @queue.subscribe()
   * async handle(payload: TPayload) {
   *   console.log(payload);
   * }
   * ```
   */
  subscribe(): MethodDecorator;
  /**
   * Subscribe to the queue with the given handler
   * @param handler - The handler function to subscribe to the queue
   * @returns A promise to subscribe to the queue
   * @example
   * ```ts
   * @queue.subscribe(async (payload: TPayload) => {
   *   console.log(payload);
   * })
   * ```
   */
  subscribe(handler: (payload: TPayload) => Promise<void>): Promise<void>;
  subscribe(
    handler?: (payload: TPayload) => Promise<void>,
  ): MethodDecorator | Promise<void> {
    if (handler) {
      return this.subscribeWithCallback(handler);
    }
    return this.createSubscribeDecorator();
  }

  private createSubscribeDecorator(): MethodDecorator {
    const topic = this.topic;
    const provider = this.provider;
    const queueOptions = this.queueOptions;

    return function (
      target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value as (
        payload: TPayload,
      ) => Promise<void>;

      const wrappedHandler = async (payload: unknown) => {
        // Use instance cache to avoid creating new instances on every message
        let instance = instanceCache.get(target.constructor);
        if (!instance) {
          instance = QueueService.instanceFactory(target.constructor);
          instanceCache.set(target.constructor, instance);
        }
        return originalMethod.apply(instance, [payload as TPayload]);
      };

      QueueService.registerTypedQueue(
        `${target.constructor.name}.${String(propertyKey)}`,
        topic,
        wrappedHandler,
        provider,
        queueOptions,
      );

      return descriptor;
    };
  }

  private async subscribeWithCallback(
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void> {
    const pubsub = QueueManager.getProvider(
      this.provider,
    ) as ProviderInstance<TProvider>;

    if (this.queueOptions) {
      // Use subscribeWithConfig when queue-specific options are provided
      return (
        pubsub as PubSubWithSubscribeConfig<TProvider, TPayload>
      ).subscribeWithConfig(this.topic, handler, this.queueOptions);
    }

    // Default: use standard subscribe
    return (pubsub as PubSubWithSubscribe<TProvider, TPayload>).subscribe(
      this.topic,
      handler,
    );
  }
}

/**
 * CustomTypedQueue for user-defined custom providers
 */
export class CustomTypedQueue<TPayload, TOptions = Record<string, unknown>> {
  constructor(
    public readonly topic: string,
    private readonly pubsub: GenericPubSub<TPayload>,
  ) {}

  async publish(
    payload: TPayload,
    options?: TOptions,
  ): Promise<{ id: string }> {
    return this.pubsub.publish(
      this.topic,
      payload,
      options as Record<string, unknown>,
    );
  }

  // Overloaded subscribe signatures
  subscribe(): MethodDecorator;
  subscribe(handler: (payload: TPayload) => Promise<void>): Promise<void>;
  subscribe(
    handler?: (payload: TPayload) => Promise<void>,
  ): MethodDecorator | Promise<void> {
    if (handler) {
      return this.pubsub.subscribe(this.topic, handler);
    }
    return this.createSubscribeDecorator();
  }

  private createSubscribeDecorator(): MethodDecorator {
    const topic = this.topic;
    const pubsub = this.pubsub;

    return function (
      target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value as (
        payload: TPayload,
      ) => Promise<void>;

      const wrappedHandler = async (payload: unknown) => {
        // Use instance cache to avoid creating new instances on every message
        let instance = instanceCache.get(target.constructor);
        if (!instance) {
          instance = QueueService.instanceFactory(target.constructor);
          instanceCache.set(target.constructor, instance);
        }
        return originalMethod.apply(instance, [payload as TPayload]);
      };

      QueueService.registerCustomQueue(
        `${target.constructor.name}.${String(propertyKey)}`,
        topic,
        wrappedHandler,
        pubsub,
      );

      return descriptor;
    };
  }
}
