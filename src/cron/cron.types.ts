import type { schedule, TaskContext } from "node-cron";

export type CronSchedule = {
  name: string;
  args: Parameters<typeof schedule>;
  onFailed?: (context: TaskContext) => void | Promise<void>;
  started?: boolean;
};
export type CronScheduleParams = Parameters<typeof schedule>;

export type CronUIOptions = {
  path: string;
};

/**
 * Options accepted by the programmatic {@link import("./cron_factory.js").cron} factory.
 */
export type CronFactoryOptions = {
  /**
   * Unique name for the cron job. Required so the job can be identified, stopped and displayed in the UI.
   */
  name: string;
  /** IANA timezone in which the schedule is expressed (e.g. "Europe/Rome"). */
  timezone?: string;
  /**
   * Per-job error handler. When omitted, the job falls back to the global error handler
   * configured via `setCronGlobalErrorHandler`.
   */
  onFailed?: (context: TaskContext) => void | Promise<void>;
};

/**
 * Handle returned by the programmatic {@link import("./cron_factory.js").cron} factory.
 *
 * The handle is also callable as a method decorator, so `@cron(...)` keeps working
 * for class-based cron jobs.
 */
export type CronHandle<
  THandler extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> = {
  /** The unique name of the cron job. */
  readonly name: string;
  /**
   * Schedule the job with the given handler. Can only be called once per handle.
   * @param handler - The function to run on every tick.
   */
  start(handler: THandler): Promise<void>;
  /** Stop the scheduled job. It can be restarted with `start`. */
  stop(): void;
  /** Destroy the scheduled job, freeing its resources. */
  destroy(): void;
} & MethodDecorator;
