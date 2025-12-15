import type { Job, Queue } from "bullmq";
import { SyncOrAsync } from "../../../type_util.js";

/**
 * Options for BullMQ configuration
 * @param options - The options for BullMQ
 * @param errorHandler - Custom error handler that will be triggered when a job fails, for logging or debug purposes
 */
export type BullMQConfigurationOptions = ConstructorParameters<
  typeof Queue
>[1] & { errorHandler?: (job: Job, error: Error) => SyncOrAsync };

export class BullMQConfiguration {
  static options: BullMQConfigurationOptions = {
    connection: {},
  };
}

/**
 * Define globally custom BullMQ configuration
 * @param options - The BullMQ configuration options
 */
export const defineBullMQConfiguration = (
  options: BullMQConfigurationOptions,
): void => {
  BullMQConfiguration.options = options ?? {
    connection: {},
  };
};
