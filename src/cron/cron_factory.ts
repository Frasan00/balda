import type { TaskFn } from "node-cron";
import { CronService } from "./cron.js";
import type { CronFactoryOptions, CronHandle } from "./cron.types.js";

/**
 * Cron builder and decorator.
 *
 * Used as a decorator on a class method to schedule a recurring job:
 * ```ts
 * class Cleanup {
 *   @cron("0 0 * * *", { name: "cleanup" })
 *   run() {
 *     console.log("cleaning up");
 *   }
 * }
 * ```
 *
 * Used programmatically, it returns a {@link CronHandle} with `start`/`stop`/
 * `destroy`, without any glob imports or `CronService.run()` call:
 * ```ts
 * const cleanup = cron("0 0 * * *", { name: "cleanup" });
 * await cleanup.start(() => console.log("cleaning up"));
 * cleanup.stop();
 * ```
 */
export const cron = <THandler extends TaskFn>(
  schedule: string,
  options?: CronFactoryOptions,
): CronHandle<THandler> => {
  let scheduledTask: import("node-cron").ScheduledTask | null = null;
  let started = false;
  let name = options?.name ?? "";

  const decorator = (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    name = options?.name ?? `${target.constructor.name}.${String(propertyKey)}`;

    const wrappedMethod = async (...args: unknown[]) => {
      const instance = new (target.constructor as new () => object)();
      return await originalMethod.apply(instance, args);
    };

    CronService.register(name, schedule, wrappedMethod, {
      timezone: options?.timezone,
    });

    return descriptor;
  };

  Object.assign(decorator, {
    start: async (fn: THandler) => {
      if (started) {
        throw new Error(`Cron job "${name}" is already started`);
      }

      name = options?.name ?? name;
      const nodeCronModule = (await import("node-cron")).default;
      scheduledTask = nodeCronModule.schedule(schedule, fn as TaskFn, {
        timezone: options?.timezone,
        ...(name ? { name } : {}),
      });

      if (options?.onFailed) {
        scheduledTask.on("execution:failed", options.onFailed);
      }

      started = true;
    },
    stop: () => {
      scheduledTask?.stop();
      started = false;
    },
    destroy: () => {
      scheduledTask?.destroy();
      started = false;
      scheduledTask = null;
    },
  });

  return new Proxy(decorator, {
    get(target, prop, receiver) {
      if (prop === "name") {
        return name;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as CronHandle<THandler>;
};
