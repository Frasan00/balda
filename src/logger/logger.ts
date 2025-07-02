import pino from "pino";
import type { LoggerOptions } from "./logger_types";

export const createLogger = (options?: LoggerOptions) => {
  const baseOptions: LoggerOptions = {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  };

  return pino({
    ...baseOptions,
    ...options,
  });
};
