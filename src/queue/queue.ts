import { BullMQPubSub } from "./providers/bullmq/bullmq.js";
import { PGBossPubSub } from "./providers/pgboss/pgboss.js";
import { SQSPubSub } from "./providers/sqs/sqs.js";
import type { GenericPubSub, QueueProviderKey } from "./queue_types.js";

export class QueueManager {
  static map: Map<QueueProviderKey, GenericPubSub> = new Map();

  static {
    this.map.set("bullmq", new BullMQPubSub() as GenericPubSub<"bullmq">);
    this.map.set("sqs", new SQSPubSub() as GenericPubSub<"sqs">);
    this.map.set("pgboss", new PGBossPubSub() as GenericPubSub<"pgboss">);
  }

  static getProvider<P extends QueueProviderKey>(
    provider: P,
  ): GenericPubSub<P> {
    if (!this.map.has(provider)) {
      throw new Error(`[QueueSubscriber] Provider ${provider} not found`);
    }

    return this.map.get(provider)! as GenericPubSub<P>;
  }

  static setProvider(
    provider: QueueProviderKey,
    pubsub: GenericPubSub<QueueProviderKey>,
  ) {
    this.map.set(provider, pubsub);
  }
}
