import { queue } from "src/index";

declare module "../../../src/queue/queue_types" {
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
