import type { Queue } from "bullmq";
import type { BullMQPubSub } from "./providers/bullmq/bullmq.js";
import type { PGBossPubSub } from "./providers/pgboss/pgboss.js";
import type { SQSPubSub } from "./providers/sqs/sqs.js";
import type PgBoss from "pg-boss";
import type { SQSClient } from "@aws-sdk/client-sqs";

type BullMQAddTaskOptions = Parameters<Queue["add"]>[2];
export type PGBossSendOptions = Parameters<PgBoss["send"]>[2];
export type SQSPublishOptions = Parameters<SQSClient["send"]>[0];

export type PublishOptions<T extends QueueProviderKey> = T extends "bullmq"
  ? BullMQAddTaskOptions
  : T extends "sqs"
    ? SQSPublishOptions
    : T extends "pgboss"
      ? PGBossSendOptions
      : never;

export interface QueueTopic {}
export type QueueTopicKey = keyof QueueTopic;

export interface PubSub<P extends QueueProviderKey = any> {
  publish: <T extends QueueTopicKey>(
    topic: T,
    payload: QueueTopic[T],
    options: PublishOptions<P>,
  ) => Promise<{ id: string }>;
  subscribe: <T extends QueueTopicKey>(
    topic: T,
    handler: (payload: QueueTopic[T]) => Promise<void>,
  ) => Promise<void>;
}

export interface QueueProvider {
  bullmq: BullMQPubSub;
  sqs: SQSPubSub;
  pgboss: PGBossPubSub;
}
export type QueueProviderKey = keyof QueueProvider;
