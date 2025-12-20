import { queues } from "../queues.js";

// Define payload type
type TestPayload = {
  name: string;
};

export class PGBossHandler {
  @queues.pgboss.subscribe()
  async handle(payload: TestPayload) {
    console.log("[PGBoss] Received payload:", payload);
  }
}
