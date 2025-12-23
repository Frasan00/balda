import type { Job, Queue, Worker } from "bullmq";
import { ClientNotFoundError } from "../../../errors/client_not_found_error.js";
import { nativeCrypto } from "../../../runtime/native_crypto.js";
import type {
  BullMQQueueOptions,
  GenericPubSub,
  PublishOptions,
} from "../../queue_types.js";
import { BullMQConfiguration } from "./bullmq_configuration.js";

export class BullMQPubSub implements GenericPubSub {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  declare private bullmqClient: typeof import("bullmq");

  async publish<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"bullmq">,
  ): Promise<{ id: string }> {
    const queue = await this.getQueue(topic);
    const jobId = nativeCrypto.randomUUID();
    await queue.add(topic, payload, {
      jobId: jobId,
      ...BullMQConfiguration.options?.defaultJobOptions,
      ...options,
    });

    return { id: jobId };
  }

  async subscribe<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void> {
    if (this.workers.has(topic)) {
      throw new Error(`[BullMQ] Already subscribed to topic "${topic}"`);
    }

    const { errorHandler, ...rest } = BullMQConfiguration.options ?? {};
    const bullmqClient = await this.getBullMQClient();
    const worker = new bullmqClient.Worker(
      topic,
      async (job: Job) => {
        try {
          await handler(job.data);
        } catch (error) {
          (await errorHandler?.(job, error as Error)) ?? Promise.reject(error);
        }
      },
      {
        ...rest,
      },
    );

    this.workers.set(topic, worker);
  }

  async unsubscribe(topic: string): Promise<void> {
    const worker = this.workers.get(topic);
    if (worker) {
      await worker.close();
      this.workers.delete(topic);
    }
  }

  private async getQueue(topic: string): Promise<Queue> {
    if (!this.queues.has(topic)) {
      const bullmqClient = await import("bullmq").catch(() => {
        throw new ClientNotFoundError("bullmq", "ioredis");
      });

      const queue = new bullmqClient.Queue(topic, {
        ...(BullMQConfiguration.options || { connection: {} }),
      });

      this.queues.set(topic, queue);
    }

    return this.queues.get(topic)!;
  }

  private async getBullMQClient(): Promise<typeof import("bullmq")> {
    if (!this.bullmqClient) {
      this.bullmqClient = await import("bullmq").catch(() => {
        throw new ClientNotFoundError("bullmq", "ioredis");
      });
    }

    return this.bullmqClient;
  }

  // Methods for TypedQueue with per-queue config
  async publishWithConfig<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"bullmq">,
    queueConfig?: BullMQQueueOptions,
  ): Promise<{ id: string }> {
    const queue = await this.getQueueWithConfig(topic, queueConfig);
    const jobId = nativeCrypto.randomUUID();

    // Merge global default job options with queue-specific and call-time options
    const mergedOptions = {
      jobId,
      ...BullMQConfiguration.options?.defaultJobOptions,
      ...queueConfig?.defaultJobOptions,
      ...options,
    };

    await queue.add(topic, payload, mergedOptions);
    return { id: jobId };
  }

  async subscribeWithConfig<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
    queueConfig?: BullMQQueueOptions,
  ): Promise<void> {
    const workerKey = this.getWorkerKey(topic, queueConfig);
    if (this.workers.has(workerKey)) {
      throw new Error(`[BullMQ] Already subscribed to topic "${topic}"`);
    }

    const globalConfig = BullMQConfiguration.options ?? {};
    const { errorHandler } = globalConfig;
    const bullmqClient = await this.getBullMQClient();

    const workerOptions = {
      ...globalConfig,
      ...queueConfig,
    };

    delete (workerOptions as Record<string, unknown>).errorHandler;
    delete (workerOptions as Record<string, unknown>).defaultJobOptions;

    const worker = new bullmqClient.Worker(
      topic,
      async (job: Job) => {
        try {
          await handler(job.data);
        } catch (error) {
          (await errorHandler?.(job, error as Error)) ?? Promise.reject(error);
        }
      },
      workerOptions,
    );

    this.workers.set(workerKey, worker);
  }

  private async getQueueWithConfig(
    topic: string,
    queueConfig?: BullMQQueueOptions,
  ): Promise<Queue> {
    const queueKey = this.getQueueKey(topic, queueConfig);

    if (!this.queues.has(queueKey)) {
      const bullmqClient = await import("bullmq").catch(() => {
        throw new ClientNotFoundError("bullmq", "ioredis");
      });

      // Merge global config with queue-specific config
      const mergedConfig = {
        ...(BullMQConfiguration.options || { connection: {} }),
        ...queueConfig,
      };

      const queue = new bullmqClient.Queue(topic, mergedConfig);
      this.queues.set(queueKey, queue);
    }

    return this.queues.get(queueKey)!;
  }

  private getQueueKey(topic: string, queueConfig?: BullMQQueueOptions): string {
    // Create a unique key based on topic and connection config
    if (queueConfig?.connection) {
      return `${topic}:${JSON.stringify(queueConfig.connection)}`;
    }
    return topic;
  }

  private getWorkerKey(
    topic: string,
    queueConfig?: BullMQQueueOptions,
  ): string {
    return this.getQueueKey(topic, queueConfig);
  }
}
