import { nativeCrypto } from "../../../runtime/native_crypto.js";
import type { GenericPubSub } from "../../queue_types.js";

type QueueHandler<T = unknown> = (payload: T) => Promise<void>;

export class MemoryPubSub implements GenericPubSub {
  private subscribers: Map<string, Set<QueueHandler>> = new Map();
  private messageQueue: Array<{ topic: string; payload: unknown }> = [];
  private readonly maxQueueSize: number;
  private processingPromise: Promise<void> | null = null;

  constructor(maxQueueSize = 10000) {
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Clear all subscribers and pending messages
   * @internal Used for test cleanup
   */
  clear(): void {
    this.subscribers.clear();
    this.messageQueue = [];
    this.processingPromise = null;
  }

  async publish<TPayload>(
    topic: string,
    payload: TPayload,
    _options?: Record<string, unknown>,
  ): Promise<{ id: string }> {
    // Backpressure: reject if queue is full
    if (this.messageQueue.length >= this.maxQueueSize) {
      throw new Error(`Queue full: ${this.maxQueueSize} messages pending`);
    }

    const id = nativeCrypto.randomUUID();
    this.messageQueue.push({ topic, payload });

    // Start processing if not already running
    if (!this.processingPromise) {
      this.processingPromise = this.processQueue()
        .catch((err) => {
          console.error("[MemoryPubSub] Fatal queue processing error:", err);
        })
        .finally(() => {
          this.processingPromise = null;
        });
    }

    return { id };
  }

  async subscribe<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void> {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }

    const typedHandler = handler as QueueHandler;
    this.subscribers.get(topic)!.add(typedHandler);
  }

  async unsubscribe(topic: string): Promise<void> {
    this.subscribers.delete(topic);
  }

  private async processQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) {
        break;
      }

      const handlers = this.subscribers.get(message.topic);
      if (handlers && handlers.size > 0) {
        await Promise.allSettled(
          Array.from(handlers).map((handler) =>
            handler(message.payload).catch((error) => {
              console.error(
                `[MemoryPubSub] Handler error for topic "${message.topic}":`,
                error,
              );
            }),
          ),
        );
      }
    }
  }
}
