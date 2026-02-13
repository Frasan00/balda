import pino from "pino";
import type { LoggerOptions } from "./logger_types.js";

const createBaseLogger = () => {
  const baseOptions: LoggerOptions = {
    level: "info",
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  };

  return pino(baseOptions);
};

/**
 * The default logger instance used internally by Balda.
 * To use a custom logger, pass a pino instance to `new Server({ logger })` or `CommandRegistry.setLogger()`.
 */
export const logger = createBaseLogger();
