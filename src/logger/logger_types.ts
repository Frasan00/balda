import type { pino } from "pino";

export type LoggerOptions = Parameters<typeof pino>[0];
