import type { LoggerOptions } from "src/logger/logger_types";

export interface LogOptions {
  /**
   * Whether to log the request.
   * @default true
   */
  logRequest?: boolean;
  /**
   * What to log for the request.
   * @default true for all properties
   */
  requestPayload?: {
    method?: boolean;
    url?: boolean;
    ip?: boolean;
    headers?: boolean;
    /** Only json objects and strings are logged */
    body?: boolean;
  };
  /**
   * Whether to log the response.
   * @default true
   */
  logResponse?: boolean;
  /**
   * What to log for the response.
   * @default true for all properties
   */
  pinoOptions?: LoggerOptions;
}
