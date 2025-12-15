import { queue } from "../../../src/index.js";

declare module "../../../src/queue/queue_types.js" {
  export interface QueueTopic {
    test: {
      name: string;
    };
  }
}

export class SQSHandler {
  @queue.sqs("test")
  async handle(payload: { name: string }) {
    console.log("[SQS] Received payload:", payload);
  }
}
