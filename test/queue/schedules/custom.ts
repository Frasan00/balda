import { queues } from "../queues.js";

// Define payload type
type TestPayload = {
  name: string;
};

export class CustomHandler {
  @queues.custom.subscribe()
  async handle(payload: TestPayload) {
    console.log("[Custom] Received payload:", payload);
  }
}
