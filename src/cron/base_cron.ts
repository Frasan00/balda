import { logger } from "../logger/logger.js";

/**
 * Base class for cron jobs with logger instance
 * @example
 * export default class MyCron extends BaseCron {
 *   @cron("* * * * *")
 *   handle() {
 *     this.logger.info("Running cron job");
 *   }
 * }
 */
export class BaseCron {
  protected readonly logger = logger.child({ scope: this.constructor.name });
}
