import { nativeFs } from "../runtime/native_fs.js";
import type { TaskContext } from "node-cron";
import { BaldaError } from "../errors/balda_error.js";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { router } from "../server/router/router.js";
import { cronUIInstance } from "./cron-ui.js";
import {
  CronSchedule,
  CronScheduleParams,
  CronUIOptions,
} from "./cron.types.js";

export class CronService {
  static scheduledJobs: CronSchedule[] = [];
  static logger = logger.child({ scope: "CronService" });

  /**
   * @description Schedule a cron job.
   * @example
   * CronService.register('test', '0 0 * * *', () => {
   *   console.log('test');
   * }, {
   *   timezone: 'Europe/Istanbul',
   * });
   */
  static register(
    name: string,
    ...args: CronScheduleParams
  ): CronSchedule & { stop: () => void } {
    args[2] = {
      name,
      ...args[2],
    };

    const job: CronSchedule = { name, args };
    this.scheduledJobs.push(job);

    return { ...job, stop: () => this.stopJob(name) };
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

    this.logger.info("Scheduling cron jobs");
    if (!this.scheduledJobs.length) {
      this.logger.info("No cron jobs to schedule");
      return;
    }

    for (const job of this.scheduledJobs) {
      if (job.started) {
        continue;
      }
      this.scheduleJob(nodeCronModule, job);
    }

    this.logger.info("Cron jobs scheduled");
  }

  private static scheduleJob(
    nodeCronModule: import("node-cron").NodeCron,
    job: CronSchedule,
  ) {
    this.logger.info(`Scheduling cron job: ${job.name}`);
    const scheduledJob = nodeCronModule.schedule(...job.args);
    scheduledJob.on("execution:failed", (context) => {
      if (job.onFailed) {
        job.onFailed(context);
      } else {
        this.globalErrorHandler(context);
      }
    });
    job.started = true;
  }

  /**
   * @description Stop a scheduled cron job by name. Returns false when no matching job is scheduled.
   */
  static stopJob(name: string): boolean {
    const job = this.scheduledJobs.find((j) => j.name === name);
    if (!job) {
      return false;
    }
    delete (job as { started?: boolean }).started;
    return true;
  }

  /**
   * @description Main error handler for cron jobs. You can write your own error handler by overriding this static method for example with sentry.
   */
  static globalErrorHandler(context: TaskContext) {
    this.logger.error(context.execution?.error);
  }

  /**
   * @description Import all cron jobs from the app/cron/schedules directory
   */
  static async massiveImportCronJobs(cronJobPatterns: string[]) {
    const allFiles: string[] = [];

    for (const pattern of cronJobPatterns) {
      const files = await nativeFs.glob(pattern, {
        cwd: nativeCwd.getCwd(),
      });

      allFiles.push(...files);
    }

    await Promise.all(
      allFiles.map(async (file) => {
        await import(file).catch((error) => {
          this.logger.error(`Error importing cron job: ${file}`);
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

  router.addOrUpdate(
    "GET",
    cronUIOptions.path,
    [],
    (_req, res) => {
      res.html(html);
    },
    undefined,
    undefined,
    undefined,
    true,
  );
};
