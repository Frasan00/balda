import type { RunTimeType } from "../runtime/runtime";
import type { RuntimeServerMap, ServerListenCallback, ServerRouteMiddleware } from "../runtime/server/server_types";
import type { Response } from "./response";

export interface ServerOptions {
  /** The port to listen on, defaults to 80 */
  port?: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host?: string;
  /** Controller patterns to match, defaults to "**" which means all controllers defined in the root path will be matched */
  controllerPatterns?: string[];
}

export interface ServerInterface {
  isListening: boolean;
  url: string;
  port: number;
  host: string;
  getServer: <T extends RunTimeType>(runtime?: T) => RuntimeServerMap<T>;
  defineMiddleware: <T extends string>(name: T, middleware: ServerRouteMiddleware) => void;
  globalMiddleware: (middleware: ServerRouteMiddleware) => void;
  setErrorHandler: (errorHandler?: (req: Request, res: Response, next: () => void, error: Error) => void) => void;
  listen: (cb?: ServerListenCallback) => Promise<void>;
  close: () => Promise<void>;
}

export type MiddlewareRegistry = {
  [K in string]: ServerRouteMiddleware;
};
