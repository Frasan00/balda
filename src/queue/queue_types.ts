import type {
  SendMessageCommandInput,
  SQSClientConfig,
} from "@aws-sdk/client-sqs";
import type { Queue, JobsOptions } from "bullmq";
import type { BullMQPubSub } from "./providers/bullmq/bullmq.js";
import type { PGBossPubSub } from "./providers/pgboss/pgboss.js";
import type { SQSPubSub } from "./providers/sqs/sqs.js";
import type { SendOptions } from "pg-boss";

type BullMQAddTaskOptions = JobsOptions;
export type PGBossSendOptions = SendOptions;
export type SQSPublishOptions = Omit<SendMessageCommandInput, "MessageBody">;

// Built-in provider keys
export type BuiltInProviderKey = "bullmq" | "sqs" | "pgboss";

export type PublishOptions<T extends BuiltInProviderKey> = T extends "bullmq"
  ? BullMQAddTaskOptions
  : T extends "sqs"
    ? SQSPublishOptions
    : T extends "pgboss"
      ? PGBossSendOptions
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

// Generic PubSub interface for typed queues
export interface GenericPubSub<TPayload = unknown> {
  publish(
    topic: string,
    payload: TPayload,
    options?: Record<string, unknown>,
  ): Promise<{ id: string }>;
  subscribe(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void>;
}

// Built-in queue providers
export interface QueueProvider {
  bullmq: BullMQPubSub;
  sqs: SQSPubSub;
  pgboss: PGBossPubSub;
}
export type QueueProviderKey = keyof QueueProvider;
