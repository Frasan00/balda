import { logger } from "../logger/logger.js";

/**
 * Base class for queue handlers with logger instance
 * @example
 * export default class MyQueue extends BaseQueue {
 *   @queue("bullmq", "my-topic")
 *   async handle(payload: MyPayload) {
 *     this.logger.info({ payload }, "Processing queue message");
 *   }
 * }
 */
export class BaseQueue {
  protected readonly logger = logger.child({ scope: this.constructor.name });
}
