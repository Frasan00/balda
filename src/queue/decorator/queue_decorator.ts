import type {
  QueueProviderKey,
  QueueTopic,
  QueueTopicKey,
} from "src/queue/queue_types";
import { QueueService } from "../queue_service";

/**
 * Decorator to register a queue handler
 * @param provider - The provider to use
 * @param topic - The topic to subscribe to
 * @returns A function to decorate the handler
 */
export const queue = <P extends QueueProviderKey, T extends QueueTopicKey>(
  provider: P,
  topic: T,
) => {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      payload: QueueTopic[T],
    ) => Promise<void>;

    const wrappedHandler = async (payload: QueueTopic[T]) => {
      const instance = new target.constructor();
      return originalMethod.apply(instance, [payload]);
    };

    QueueService.register(
      `${target.constructor.name}.${propertyKey}`,
      topic,
      wrappedHandler,
      { provider },
    );

    return descriptor;
  };
};

/**
 * Decorator to register a queue handler for BullMQ
 * @param topic - The topic to subscribe to
 * @returns A function to decorate the handler
 */
queue.bullmq = <T extends QueueTopicKey>(topic: T) => queue("bullmq", topic);

/**
 * Decorator to register a queue handler for SQS
 * @param topic - The topic to subscribe to
 * @returns A function to decorate the handler
 */
queue.sqs = <T extends QueueTopicKey>(topic: T) => queue("sqs", topic);

/**
 * Decorator to register a queue handler for PGBoss
 * @param topic - The topic to subscribe to
 * @returns A function to decorate the handler
 */
queue.pgboss = <T extends QueueTopicKey>(topic: T) => queue("pgboss", topic);
