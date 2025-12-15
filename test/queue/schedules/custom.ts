import { queue } from "../../../src/index.js";
import {
  PubSub,
  QueueTopic,
  QueueTopicKey,
} from "../../../src/queue/queue_types.js";

declare module "../../../src/queue/queue_types.js" {
  export interface QueueProvider {
    custom: PubSub<"custom">;
  }
}

export class CustomPubSub implements PubSub<"custom"> {
  async publish<T extends QueueTopicKey>(
    topic: T,
    payload: QueueTopic[T],
  ): Promise<{ id: string }> {
    console.log(topic, payload);
    return { id: "1" };
  }

  async subscribe<T extends QueueTopicKey>(
    topic: T,
    handler: (payload: QueueTopic[T]) => Promise<void>,
  ) {
    console.log("Subscribed to topic", topic);
    return Promise.resolve(handler({ name: "test" }));
  }
}

export class CustomHandler {
  @queue("custom", "test")
  async handle(payload: { name: string }) {
    console.log("[Custom] Received payload:", payload);
  }
}
