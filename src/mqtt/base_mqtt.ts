import { logger } from "../logger/logger.js";

/**
 * Base class for MQTT handlers with logger instance
 * @example
 * declare module "balda" {
 *   export interface BaseMqtt {
 *     logger: Logger;
 *   }
 * }
 *
 * export default class TemperatureHandler extends BaseMqtt {
 *   @mqtt("home/temperature")
 *   handle(topic: string, message: Buffer) {
 *     this.logger.info("Received temperature:", message.toString());
 *   }
 * }
 */
export class BaseMqtt {
  protected readonly logger = logger.child({ scope: this.constructor.name });
}
