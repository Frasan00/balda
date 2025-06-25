import pino, { type Logger } from "pino";
import type { LoggerOptions } from "./logger_types";

export const createLogger = (options?: LoggerOptions): Logger => {
  return pino({
    level: options?.level ?? "info",
    transport: !options?.prettyPrint
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
    name: options?.name ?? "balda",
  });
};

export const logger = createLogger();
