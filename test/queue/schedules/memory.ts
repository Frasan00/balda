import { queues } from "../queues.js";

type TestPayload = {
  name: string;
};

export class MemoryHandler {
  @queues.memory.subscribe()
  async handle(payload: TestPayload) {
    console.log("[Memory] Received payload:", payload);
  }
}
