import { CronService } from "../cron";
import type { CronScheduleParams } from "../cron.types";

/**
 * Decorator to schedule a cron job. Must be applied to a class method. By default, the cron job will not overlap with other cron jobs of the same type.
 * ```ts
 * @cron('* * * * *', { timezone: 'Europe/Istanbul' })
 * async test() {
 *   console.log('test');
 * }
 * ```
 */
export const cron = (
  schedule: CronScheduleParams[0],
  options?: CronScheduleParams[2],
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    CronService.register(
      `${target.constructor.name}.${propertyKey}`,
      schedule,
      originalMethod.bind(target),
      options,
    );

    return descriptor;
  };
};
