import type {
  SendMessageCommandInput,
  SQSClientConfig,
} from "@aws-sdk/client-sqs";
import type { JobsOptions, Queue } from "bullmq";
import type { SendOptions } from "pg-boss";
import type { BullMQPubSub } from "./providers/bullmq/bullmq.js";
import type { MemoryPubSub } from "./providers/memory/memory.js";
import type { PGBossPubSub } from "./providers/pgboss/pgboss.js";
import type { SQSPubSub } from "./providers/sqs/sqs.js";

type BullMQAddTaskOptions = JobsOptions;
export type PGBossSendOptions = SendOptions;
export type SQSPublishOptions = Omit<SendMessageCommandInput, "MessageBody">;

/**
 * Built-in provider keys
 */
export type BuiltInProviderKey = "bullmq" | "sqs" | "pgboss" | "memory";

export type PublishOptions<T extends BuiltInProviderKey> = T extends "bullmq"
  ? BullMQAddTaskOptions
  : T extends "sqs"
    ? SQSPublishOptions
    : T extends "pgboss"
      ? PGBossSendOptions
      : T extends "memory"
        ? Record<string, unknown>
        : never;

// Per-queue configuration options for factory functions
export type SQSQueueOptions = {
  queueUrl: string;
  client?: SQSClientConfig;
};

export type BullMQQueueOptions = ConstructorParameters<typeof Queue>[1];

export type PGBossQueueOptions = {
  connectionString?: string;
};

/**
 * Generic PubSub interface for typed queues
 * @template TPayload - The type of the payload
 * @returns A Promise that resolves to an object with an id property
 * @example
 * ```typescript
 * const pubsub: GenericPubSub<{ name: string }> = {
 *   async publish(topic, payload, options) {
 *     return { id: '123' };
 *   },
 *   async subscribe(topic, handler) {
 *     console.log('subscribed');
 *   },
 *   async unsubscribe(topic) {
 *     console.log('unsubscribed');
 *   },
 * };
 * ```
 */
export interface GenericPubSub<TPayload = unknown> {
  /*+
   * Publish a message to the queue
   * @param topic - The topic to publish the message to
   * @param payload - The payload to publish
   * @param options - The options to publish the message with
   * @returns A Promise that resolves to an object with an id property
   */
  publish(
    topic: string,
    payload: TPayload,
    options?: Record<string, unknown>,
  ): Promise<{ id: string }>;
  /*+
   * Subscribe to a queue
   * @param topic - The topic to subscribe to
   * @param handler - The handler function to subscribe to the queue
   * @returns A Promise that resolves when subscription is complete
   * @example
   * ```typescript
   * await pubsub.subscribe('test', async (payload) => {
   *   console.log(payload);
   * });
   * ```
   */
  subscribe(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void>;
  /*+
   * Unsubscribe from a queue
   * @param topic - The topic to unsubscribe from
   * @returns A Promise that resolves when unsubscription is complete
   * @example
   * ```typescript
   * await pubsub.unsubscribe('test');
   * ```
   */
  unsubscribe(topic: string): Promise<void>;
}

// Built-in queue providers
export interface QueueProvider {
  bullmq: BullMQPubSub;
  sqs: SQSPubSub;
  pgboss: PGBossPubSub;
  memory: MemoryPubSub;
}
export type QueueProviderKey = keyof QueueProvider;
