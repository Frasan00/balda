import { queue } from "src/index";

declare module "../../../src/queue/queue_types" {
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
