import { CronService } from "../cron.js";
import type { CronScheduleParams } from "../cron.types.js";

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
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    const wrappedMethod = async (...args: any[]) => {
      const instance = new target.constructor();
      return await originalMethod.apply(instance, args);
    };

    CronService.register(
      `${target.constructor.name}.${propertyKey}`,
      schedule,
      wrappedMethod,
      options,
    );

    return descriptor;
  };
};
