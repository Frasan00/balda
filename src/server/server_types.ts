import type { Logger } from "pino";
import type { createLogger } from "../logger/logger";
import type { CorsOptions } from "../plugins/cors/cors_types";
import type { JsonOptions } from "../plugins/json/json_options";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
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
  /**
   * Whether the server is listening for requests
   */
  isListening: boolean;
  /**
   * The logger for the server
   */
  logger: Logger;
  /**
   * The url of the server
   */
  url: string;
  /**
   * The port of the server
   */
  port: number;
  /**
   * The host of the server
   */
  host: string;
  /**
   * Settings applied before server is listening, this is used to tap into the server connector for the current runtime and modify it before it is used to listen for incoming requests
   * @warning Must be used before `listen` method
   */
  tapOptions?: ServerTapOptions;

  /**
   * Adds a GET route to the server, useful for defining simple global routes, use decorators to define more complex routes
   */
  get: (...args: any[]) => void;

  /**
   * Adds a POST route to the server, useful for defining simple global routes, use decorators to define more complex routes
   */
  post: (...args: any[]) => void;

  /**
   * Adds a PUT route to the server, useful for defining simple global routes, use decorators to define more complex routes
   */
  put: (...args: any[]) => void;

  /**
   * Adds a PATCH route to the server, useful for defining simple global routes, use decorators to define more complex routes
   */
  patch: (...args: any[]) => void;

  /**
   * Adds a DELETE route to the server, useful for defining simple global routes, use decorators to define more complex routes
   */
  delete: (...args: any[]) => void;

  /**
   * The server connector for the current runtime, this is used to listen for incoming requests
   */
  getRuntimeServer: <T extends RunTimeType>(runtime?: T) => RuntimeServerMap<T>;

  /**
   * Embeds a value into the server, this is used to embed values into the server for use in the server
   */
  embed: (key: string, value: any) => void;

  /**
   * Register a global middleware to be applied to all routes after the listener is bound, the middleware is applied in the order it is registered
   */
  use: (middleware: ServerRouteMiddleware) => void;
  /**
   * The error handler for the server to be called when an error occurs in an incoming request
   */
  setErrorHandler: (errorHandler?: ServerErrorHandler) => void;
  /**
   * The function to listen for incoming requests, routes are registered when this function is called
   */
  listen: (cb?: ServerListenCallback) => Promise<void>;
  /**
   * The function to close the server
   */
  close: () => Promise<void>;
}

export type MiddlewareRegistry = {
  [K in string]: ServerRouteMiddleware;
};
