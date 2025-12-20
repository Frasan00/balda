import { queues } from "../queues.js";

// Define payload type
type TestPayload = {
  name: string;
};

export class SQSHandler {
  @queues.sqs.subscribe()
  async handle(payload: TestPayload) {
    console.log("[SQS] Received payload:", payload);
  }
}
