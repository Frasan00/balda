import { CronService } from "../../cron/cron.js";
import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { Command } from "../base_command.js";
import type { CommandOptions } from "../command_types.js";

export default class CronStartCommand extends Command {
  static commandName = "cron-start";
  static description = "Start cron job scheduler";
  static help = [
    "Start the cron job scheduler to run scheduled tasks",
    "Loads cron jobs from specified patterns and starts scheduling",
    "Example: npx balda cron-start",
    "Example: npx balda cron-start src/crons/**/*.ts --patterns src/schedules/**/*.ts",
  ];

  static options: CommandOptions = {
    keepAlive: true,
  };

  @arg({
    required: false,
    defaultValue: "src/crons/**/*.{ts,js}",
    description:
      "Primary glob pattern for cron jobs (default: src/crons/**/*.{ts,js})",
  })
  static pattern: string;

  @flag.array({
    aliases: ["p"],
    name: "patterns",
    required: false,
    description: "Additional glob patterns for cron jobs",
  })
  static additionalPatterns?: string[];

  static async handle(): Promise<void> {
    this.logger.info("Starting cron scheduler...");

    const patterns = [this.pattern];

    if (this.additionalPatterns && this.additionalPatterns.length > 0) {
      patterns.push(...this.additionalPatterns);
    }

    this.logger.info(`Loading cron jobs from patterns: ${patterns.join(", ")}`);

    await CronService.massiveImportCronJobs(patterns);

    const jobCount = CronService.scheduledJobs.length;
    if (jobCount === 0) {
      this.logger.warn(
        "No cron jobs found. Make sure your cron jobs are decorated with @cron decorator",
      );
      return;
    }

    this.logger.info(`Found ${jobCount} cron job(s)`);

    CronService.run()
      .then(() => {
        this.logger.info(
          "Cron scheduler started successfully. Press Ctrl+C to stop.",
        );
      })
      .catch((error) => {
        this.logger.error("Error starting cron scheduler", error);
      });
  }
}
