import { glob } from "glob";
import type { TaskContext } from "node-cron";
import {
  CronUIOptions,
  CronSchedule,
  CronScheduleParams,
} from "./cron.types.js";
import { BaldaError } from "../errors/balda_error.js";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import {cronUIInstance} from "./cron-ui.js";
import {router} from "../server/router/router.js";

export class CronService {
  static scheduledJobs: CronSchedule[] = [];

  /**
   * @description Schedule a cron job.
   * @internal
   * @example
   * CronService.register('test', '0 0 * * *', () => {
   *   console.log('test');
   * }, {
   *   timezone: 'Europe/Istanbul',
   * });
   */
  static register(name: string, ...args: CronScheduleParams): void {
    args[2] = {
      name,
      ...args[2],
    };

    this.scheduledJobs.push({ name, args });
  }

  /**
   * @description Start the cron scheduler.
   */
  static async run() {
    const nodeCronModule = (
      await import("node-cron").catch(() => {
        throw new BaldaError(
          "node-cron not installed as a dependency, it is required in order to run cron jobs with the @cron decorator",
        );
      })
    ).default;

    logger.info("Scheduling cron jobs");
    if (!this.scheduledJobs.length) {
      logger.info("No cron jobs to schedule");
      return;
    }

    for (const { name, args } of this.scheduledJobs) {
      logger.info(`Scheduling cron job: ${name}`);
      const scheduledJob = nodeCronModule.schedule(...args);
      scheduledJob.on("execution:failed", (context) =>
        this.globalErrorHandler(context),
      );
    }

    logger.info("Cron jobs scheduled");
  }

  /**
   * @description Main error handler for cron jobs. You can write your own error handler by overriding this static method for example with sentry.
   */
  static globalErrorHandler(context: TaskContext) {
    logger.error(context.execution?.error);
  }

  /**
   * @description Import all cron jobs from the app/cron/schedules directory
   */
  static async massiveImportCronJobs(cronJobPatterns: string[]) {
    const allFiles: string[] = [];

    for (const pattern of cronJobPatterns) {
      const files = await glob(pattern, {
        absolute: true,
        cwd: nativeCwd.getCwd(),
      });

      allFiles.push(...files);
    }

    await Promise.all(
      allFiles.map(async (file) => {
        await import(file).catch((error) => {
          logger.error(`Error importing cron job: ${file}`);
          logger.error(error);
        });
      }),
    );
  }
}

export const setCronGlobalErrorHandler = (
  globalErrorHandler: (
    ...args: Parameters<(typeof CronService)["globalErrorHandler"]>
  ) => void,
) => {
  CronService.globalErrorHandler = globalErrorHandler.bind(CronService);
};

export const cronUi = async (cronUIOptions?: CronUIOptions) => {
  if (!cronUIOptions || cronUIOptions.path.length === 0) {
    throw new BaldaError("Cron UI path is required");
  }

  const html = await cronUIInstance.generate();

  router.addOrUpdate("GET", cronUIOptions.path, [], (_req, res) => {
    res.html(html);
  });
};
