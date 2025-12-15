import { queue } from "../../../src/index.js";

declare module "../../../src/queue/queue_types.js" {
  export interface QueueTopic {
    test: {
      name: string;
    };
  }
}

export class BullMQHandler {
  @queue.bullmq("test")
  async handle(payload: { name: string }) {
    console.log("[BullMQ] Received payload:", payload);
  }
}
