import type { pino } from "pino";

export interface LoggerOptions {
  /**
   * The level of the logger.
   * @default 'info'
   */
  level?: Parameters<typeof pino>[0]["level"];
  /**
   * Whether to pretty print the logger.
   * @default true
   */
  prettyPrint?: boolean;
  /**
   * The name of the logger.
   * @default 'balda'
   */
  name?: string;
}
