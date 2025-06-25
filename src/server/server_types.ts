import type { Logger } from "pino";
import type { createLogger } from "../logger/logger";
import type { CorsOptions } from "../plugins/cors/cors_types";
import type { JsonOptions } from "../plugins/json/json_options";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteMiddleware,
} from "../runtime/native_server/server_types";
import type { RunTimeType } from "../runtime/runtime";
import type { NextFunction } from "./http/next";
import type { Response } from "./http/response";

export type ServerPlugin = {
  cors?: CorsOptions;
  json?: JsonOptions;
};

export interface ServerOptions {
  /** The port to listen on, defaults to 80 */
  port?: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host?: string;
  /** Controller patterns to match, defaults to "**" which means all controllers defined in the root path will be matched */
  controllerPatterns?: string[];
  /** Basic plugins to apply to the server, by default no plugins are applied */
  plugins?: ServerPlugin;
  /** The logger to use, defaults to the global logger */
  logger?: Parameters<typeof createLogger>[0];
}

export type ServerErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  error: Error
) => void | Promise<void>;

export interface ServerInterface {
  isListening: boolean;
  logger: Logger;
  url: string;
  port: number;
  host: string;
  getServer: <T extends RunTimeType>(runtime?: T) => RuntimeServerMap<T>;
  useGlobalMiddleware: (middleware: ServerRouteMiddleware) => void;
  setErrorHandler: (errorHandler?: ServerErrorHandler) => void;
  listen: (cb?: ServerListenCallback) => Promise<void>;
  close: () => Promise<void>;
}

export type MiddlewareRegistry = {
  [K in string]: ServerRouteMiddleware;
};
