import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { QueueService } from "../../queue/queue_service.js";
import { Command } from "../base_command.js";
import type { CommandOptions } from "../command_types.js";

export default class QueueWorkCommand extends Command {
  static commandName = "queue-start";
  static description = "Start queue workers to process jobs";
  static help = [
    "Start queue workers to process jobs from registered queues",
    "Loads queue handlers from specified patterns and starts processing",
    "Example: npx balda queue-start",
    "Example: npx balda queue-start src/queues/**/*.ts --patterns src/jobs/**/*.ts",
  ];

  static options: CommandOptions = {
    keepAlive: true,
  };

  @arg({
    required: false,
    defaultValue: "src/queues/**/*.{ts,js}",
    description:
      "Primary glob pattern for queue handlers (default: src/queues/**/*.{ts,js})",
  })
  static pattern: string;

  @flag.list({
    aliases: ["p"],
    name: "patterns",
    required: false,
    description: "Additional glob patterns for queue handlers",
  })
  static additionalPatterns?: string[];

  static async handle(): Promise<void> {
    this.logger.info("Starting queue workers...");

    const patterns = [this.pattern];

    if (this.additionalPatterns && this.additionalPatterns.length > 0) {
      patterns.push(...this.additionalPatterns);
    }

    this.logger.info(
      `Loading queue handlers from patterns: ${patterns.join(", ")}`,
    );

    await QueueService.massiveImportQueues(patterns, {
      throwOnError: false,
    });

    const typedCount = QueueService.typedQueueSubscribers.size;
    const customCount = QueueService.customQueueSubscribers.size;
    const totalCount = typedCount + customCount;

    if (totalCount === 0) {
      this.logger.warn(
        "No queue handlers found. Make sure your queue handlers are decorated with @queue decorator",
      );
      return;
    }

    this.logger.info(
      `Found ${totalCount} queue handler(s) (${typedCount} typed, ${customCount} custom)`,
    );

    QueueService.run()
      .then(() => {
        this.logger.info(
          "Queue workers started successfully. Press Ctrl+C to stop.",
        );
      })
      .catch((error) => {
        this.logger.error("Error starting queue workers", error);
      });
  }
}
