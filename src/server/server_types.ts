import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteMiddleware,
} from "../runtime/native_server/server_types";
import type { RunTimeType } from "../runtime/runtime";
import type { Response } from "./response";
import type { CorsOptions } from "../plugins/cors/cors_types";

export type ServerPlugin = {
  cors?: CorsOptions;
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
}

export interface ServerInterface {
  isListening: boolean;
  url: string;
  port: number;
  host: string;
  getServer: <T extends RunTimeType>(runtime?: T) => RuntimeServerMap<T>;
  useGlobalMiddleware: (middleware: ServerRouteMiddleware) => void;
  setErrorHandler: (
    errorHandler?: (
      req: Request,
      res: Response,
      next: () => void,
      error: Error
    ) => void
  ) => void;
  listen: (cb?: ServerListenCallback) => Promise<void>;
  close: () => Promise<void>;
}

export type MiddlewareRegistry = {
  [K in string]: ServerRouteMiddleware;
};
