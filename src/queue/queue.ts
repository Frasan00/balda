import { BullMQPubSub } from "src/queue/providers/bullmq/bullmq";
import { PGBossPubSub } from "src/queue/providers/pgboss/pgboss";
import { SQSPubSub } from "src/queue/providers/sqs/sqs";
import type { PubSub, QueueProviderKey } from "src/queue/queue_types";

export class QueueManager {
  static map: Map<QueueProviderKey, PubSub> = new Map();

  static {
    this.map.set("bullmq", new BullMQPubSub() as PubSub<"bullmq">);
    this.map.set("sqs", new SQSPubSub() as PubSub<"sqs">);
    this.map.set("pgboss", new PGBossPubSub() as PubSub<"pgboss">);
  }

  static getProvider<P extends QueueProviderKey>(provider: P): PubSub<P> {
    if (!this.map.has(provider)) {
      throw new Error(`[QueueSubscriber] Provider ${provider} not found`);
    }

    return this.map.get(provider)! as PubSub<P>;
  }

  static setProvider(
    provider: QueueProviderKey,
    pubsub: PubSub<QueueProviderKey>,
  ) {
    this.map.set(provider, pubsub);
  }
}
