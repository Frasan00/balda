import { QueueManager } from "../../queue.js";
import { PubSub, QueueProviderKey } from "../../queue_types.js";

export type CustomQueueConfiguration = PubSub;

/**
 * Define globally custom queue provider
 * @param provider - The queue provider
 * @param pubsub - The pubsub instance that handles the queue operations
 */
export const defineCustomQueueProvider = (
  provider: Omit<QueueProviderKey, "bullmq">,
  pubsub: PubSub,
): void => {
  QueueManager.setProvider(provider as QueueProviderKey, pubsub);
};
