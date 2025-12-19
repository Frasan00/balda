import { glob } from "glob";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { QueueManager } from "./queue.js";
import type { QueueProviderKey, QueueTopicKey } from "./queue_types.js";

type QueueRegistration = {
  name: string;
  topic: QueueTopicKey;
  handler: (payload: any) => Promise<void>;
  provider: QueueProviderKey;
};

export class QueueService {
  static scheduledSubscribers: QueueRegistration[] = [];

  static register(
    name: string,
    topic: QueueRegistration["topic"],
    handler: QueueRegistration["handler"],
    options?: { provider?: QueueProviderKey },
  ): void {
    this.scheduledSubscribers.push({
      name,
      topic,
      handler,
      provider: options?.provider ?? "bullmq",
    });
  }

  static async run() {
    logger.info("Subscribing queue handlers");
    if (!this.scheduledSubscribers.length) {
      logger.info("No queue handlers to subscribe");
      return;
    }

    for (const { topic, handler, provider } of this.scheduledSubscribers) {
      logger.info(`Subscribing to queue: ${String(topic)}`);
      const pubsub = QueueManager.getProvider(provider);
      await pubsub.subscribe(topic, handler as any);
    }

    logger.info("Queue handlers subscribed");
  }

  static async massiveImportQueues(queueHandlerPatterns: string[]) {
    const allFiles: string[] = [];

    for (const pattern of queueHandlerPatterns) {
      const files = await glob(pattern, {
        absolute: true,
        cwd: nativeCwd.getCwd(),
      });

      allFiles.push(...files);
    }

    await Promise.all(
      allFiles.map(async (file) => {
        await import(file).catch((error) => {
          logger.error(`Error importing queue handler: ${file}`);
          logger.error(error);
        });
      }),
    );
  }
}
