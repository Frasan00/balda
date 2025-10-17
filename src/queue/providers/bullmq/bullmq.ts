import type { Job, Queue, Worker } from "bullmq";
import type {
  PublishOptions,
  PubSub,
  QueueTopic,
  QueueTopicKey,
} from "src/queue/queue_types";
import { BullMQConfiguration } from "src/queue/providers/bullmq/bullmq_configuration";
import { ClientNotFoundError } from "src/errors/client_not_found_error";
import { nativeCrypto } from "src/runtime/native_crypto";

export class BullMQPubSub implements PubSub<"bullmq"> {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  declare private bullmqClient: typeof import("bullmq");

  async publish<T extends QueueTopicKey>(
    topic: T,
    payload: QueueTopic[T],
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

  async subscribe<T extends QueueTopicKey>(
    topic: T,
    handler: (payload: QueueTopic[T]) => Promise<void>,
  ) {
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
}
