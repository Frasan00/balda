import type {
  BullMQQueueOptions,
  GenericPubSub,
  PGBossQueueOptions,
  SQSQueueOptions,
} from "./queue_types.js";
import { CustomTypedQueue, TypedQueue } from "./typed_queue.js";

/**
 * Create a typed SQS queue
 * @param topic - The queue topic name
 * @param options - SQS-specific options including queueUrl
 * @returns A TypedQueue instance for SQS
 *
 * @example
 * ```typescript
 * const userQueue = sqsQueue<{ userId: string }>('user-events', {
 *   queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue'
 * });
 *
 * // Publishing
 * await userQueue.publish({ userId: '123' });
 *
 * // Subscribing with decorator
 * class UserHandler {
 *   @userQueue.subscribe()
 *   async handle(payload: { userId: string }) {}
 * }
 *
 * // Subscribing with callback
 * await userQueue.subscribe(async (payload) => {
 *   console.log(payload.userId);
 * });
 * ```
 */
export function sqsQueue<TPayload>(
  topic: string,
  options?: SQSQueueOptions,
): TypedQueue<TPayload, "sqs"> {
  return new TypedQueue<TPayload, "sqs">(topic, "sqs", options);
}

/**
 * Create a typed BullMQ queue
 * @param topic - The queue topic name
 * @param options - BullMQ-specific options (connection, job options, etc.)
 * @returns A TypedQueue instance for BullMQ
 *
 * @example
 * ```typescript
 * const orderQueue = bullmqQueue<{ orderId: number }>('orders', {
 *   connection: { host: 'localhost', port: 6379 }
 * });
 *
 * // Publishing
 * await orderQueue.publish({ orderId: 123 });
 *
 * // Subscribing with decorator
 * class OrderHandler {
 *   @orderQueue.subscribe()
 *   async handle(payload: { orderId: number }) {}
 * }
 * ```
 */
export function bullmqQueue<TPayload>(
  topic: string,
  options?: BullMQQueueOptions,
): TypedQueue<TPayload, "bullmq"> {
  return new TypedQueue<TPayload, "bullmq">(topic, "bullmq", options);
}

/**
 * Create a typed PGBoss queue
 * @param topic - The queue topic name
 * @param options - PGBoss-specific options
 * @returns A TypedQueue instance for PGBoss
 *
 * @example
 * ```typescript
 * const notificationQueue = pgbossQueue<{ message: string }>('notifications');
 *
 * // Publishing
 * await notificationQueue.publish({ message: 'Hello!' });
 *
 * // Subscribing with decorator
 * class NotificationHandler {
 *   @notificationQueue.subscribe()
 *   async handle(payload: { message: string }) {}
 * }
 * ```
 */
export function pgbossQueue<TPayload>(
  topic: string,
  options?: PGBossQueueOptions,
): TypedQueue<TPayload, "pgboss"> {
  return new TypedQueue<TPayload, "pgboss">(topic, "pgboss", options);
}

/**
 * Create a typed in-memory queue
 * @param topic - The queue topic name
 * @returns A TypedQueue instance for in-memory processing
 *
 * @example
 * ```typescript
 * const emailQueue = memoryQueue<{ to: string; subject: string }>('emails');
 *
 * // Publishing
 * await emailQueue.publish({ to: 'user@example.com', subject: 'Hello' });
 *
 * // Subscribing with decorator
 * class EmailHandler {
 *   @emailQueue.subscribe()
 *   async handle(payload: { to: string; subject: string }) {}
 * }
 * ```
 */
export function memoryQueue<TPayload>(
  topic: string,
): TypedQueue<TPayload, "memory"> {
  return new TypedQueue<TPayload, "memory">(topic, "memory");
}

/**
 * Create a typed queue with a custom PubSub provider
 * @param topic - The queue topic name
 * @param pubsub - A custom PubSub implementation
 * @returns A CustomTypedQueue instance for the custom provider
 *
 * @example
 * ```typescript
 * const customProvider: GenericPubSub<MyPayload> = {
 *   async publish(topic, payload, options) {
 *     // Custom publish logic
 *     return { id: 'custom-id' };
 *   },
 *   async subscribe(topic, handler) {
 *     // Custom subscribe logic
 *   }
 * };
 *
 * const customQueue = createQueue<{ data: string }>('custom-topic', customProvider);
 *
 * await customQueue.publish({ data: 'test' });
 * ```
 */
export function createQueue<TPayload, TOptions = Record<string, unknown>>(
  topic: string,
  pubsub: GenericPubSub<TPayload>,
): CustomTypedQueue<TPayload, TOptions> {
  return new CustomTypedQueue<TPayload, TOptions>(topic, pubsub);
}
