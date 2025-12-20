import { queues } from "../queues.js";

// Define payload type
type TestPayload = {
  name: string;
};

export class BullMQHandler {
  @queues.bullmq.subscribe()
  async handle(payload: TestPayload) {
    console.log("[BullMQ] Received payload:", payload);
  }
}
