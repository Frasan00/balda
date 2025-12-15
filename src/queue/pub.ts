import { QueueManager } from "./queue.js";
import type {
  PublishOptions,
  QueueProviderKey,
  QueueTopic,
  QueueTopicKey,
} from "./queue_types.js";

const publishFactory = async <
  P extends QueueProviderKey,
  T extends QueueTopicKey,
>(
  provider: P,
  topic: T,
  payload: QueueTopic[T],
  options?: PublishOptions<P>,
): Promise<{ id: string }> => {
  const pubsub = QueueManager.getProvider(provider);
  return pubsub.publish(topic, payload, options ?? ({} as PublishOptions<P>));
};

/**
 * Shorthand for publish to bullmq queue
 * @param topic - The topic to publish to
 * @param payload - The payload to publish
 * @param options - The options to use
 * @returns The id of the published job
 */
publishFactory.bullmq = async <T extends QueueTopicKey>(
  topic: T,
  payload: QueueTopic[T],
  options?: PublishOptions<"bullmq">,
): Promise<{ id: string }> => {
  return publishFactory("bullmq", topic, payload, options);
};

publishFactory.sqs = async <T extends QueueTopicKey>(
  topic: T,
  payload: QueueTopic[T],
  options?: PublishOptions<"sqs">,
): Promise<{ id: string }> => {
  return publishFactory("sqs", topic, payload, options);
};

publishFactory.pgboss = async <T extends QueueTopicKey>(
  topic: T,
  payload: QueueTopic[T],
  options?: PublishOptions<"pgboss">,
): Promise<{ id: string }> => {
  return publishFactory("pgboss", topic, payload, options);
};

/**
 * Main publisher for balda-js queue, has shortcuts for base providers, e.g. `publish.bullmq`
 * @param provider - The provider to use
 * @param topic - The topic to publish to
 * @param payload - The payload to publish
 * @param options - The options to use
 * @returns The id of the published job
 */
export const publish = publishFactory;
