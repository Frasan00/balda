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
 * The logger instance, can be overridden by the `defineLoggerConfig` function
 */
export let logger = createBaseLogger();

/**
 * Define the logger config, this will override the logger instance with the given options
 * @param options - The logger options
 */
export const defineLoggerConfig = (options?: LoggerOptions) => {
  logger = pino(options);
  return logger;
};
