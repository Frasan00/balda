import { queue } from "../../../src/index.js";

declare module "../../../src/queue/queue_types.js" {
  export interface QueueTopic {
    test: {
      name: string;
    };
  }
}

export class PGBossHandler {
  @queue.pgboss("test")
  async handle(payload: { name: string }) {
    console.log("[PGBoss] Received payload:", payload);
  }
}
