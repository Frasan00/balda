import type { CookieMiddlewareOptions } from "src/plugins/cookie/cookie_types";
import { FilePluginOptions } from "src/plugins/file/file_types";
import type { HelmetOptions } from "src/plugins/helmet/helmet_types";
import type { LogOptions } from "src/plugins/log/log_types";
import type {
    RateLimiterKeyOptions,
    StorageOptions,
} from "src/plugins/rate_limiter/rate_limiter_types";
import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import type { createLogger } from "../logger/logger";
import type { CorsOptions } from "../plugins/cors/cors_types";
import type { JsonOptions } from "../plugins/json/json_options";
import type {
    RuntimeServerMap,
    ServerListenCallback,
    ServerRouteMiddleware,
    ServerTapOptions,
} from "../runtime/native_server/server_types";
import type { NextFunction } from "./http/next";
import type { Response } from "./http/response";
import type { MockServer } from "src/mock/mock_server";
import type { UrlEncodedOptions } from "src/plugins/urlencoded/urlencoded_types";

export type ServerPlugin = {
  cors?: CorsOptions;
  json?: JsonOptions;
  static?: string;
  fileParser?: FilePluginOptions;
  helmet?: HelmetOptions;
  cookie?: CookieMiddlewareOptions;
  log?: LogOptions;
  urlencoded?: UrlEncodedOptions;
  rateLimiter?: {
    keyOptions?: RateLimiterKeyOptions;
    storageOptions?: StorageOptions;
  };
};

export interface ServerOptions {
  /** The port to listen on, defaults to 80 */
  port?: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host?: string;
  /** Controller patterns to match, defaults to "**" which means all files defined in the current working directory will be matched, you can set logger level to debug to see the controllers that are being imported or on error to see the errors during the import process */
  controllerPatterns?: string[];
  /** Basic plugins to apply to the server, by default no plugins are applied */
  plugins?: ServerPlugin;
  /** The logger to use, defaults to the global logger */
  logger?: Parameters<typeof createLogger>[0];
  /** The tap options to interact with the underlying server connector before it is used to listen for incoming requests */
  tapOptions?: ServerTapOptions;
}

export type ServerErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  error: Error,
) => void | Promise<void>;

export interface ServerInterface {
  /**
   * Whether the server is listening for requests
   */
  isListening: boolean;
  /**
   * The logger for the server
   */
  logger: ReturnType<typeof createLogger>;
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
   * The path to the temporary directory, you can append a path to the temporary directory to get a new path.
   * It uses the current working directory of the runtime to get the base path.
   * @example
   * ```ts
   * server.tmpPath("my-app"); // -> ${cwd}/tmp/my-app
   * ```
   */
  tmpDir: (append?: string) => string;

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
   * Get the node server instance, you must be using node runtime to use this method
   * @throws if the runtime is not node
   */
  getNodeServer: () => RuntimeServerMap<"node">;

  /**
   * Embed the given key into the server instance, this is useful for embedding the server with custom context inside the server instance, you can extend the server with your own properties to type it
   * @param key - The key to embed
   * @param value - The value to embed
   * @warning There are some keys that are protected and cannot be embedded, you can find the list of protected keys in the PROTECTED_KEYS constant
   * @throws An error if the key is already defined in the server instance or if the key is protected
   * @example
   * ```typescript
   * // For better type safety, you can declare a module for the server interface
   * declare module "balda" {
   *   interface ServerInterface {
   *     myCustomProperty: string;
   *   }
   * }
   *
   * server.embed("myCustomProperty", "myCustomValue");
   * console.log(server.myCustomProperty); // Type safe if ServerInterface is extended
   * ```
   */
  embed: (key: string, value: any) => void;

  /**
   * Register a global middleware to be applied to all routes after the listener is bound, the middleware is applied in the order it is registered
   */
  use: (middleware: ServerRouteMiddleware) => void;
  /**
   * Set the error handler for the server
   * @param errorHandler - The error handler to be applied to all routes
   */
  setErrorHandler: (errorHandler?: ServerErrorHandler) => void;
  /**
   * Binds the server to the port and hostname defined in the serverOptions, meant to be called only once
   * @warning All routes defined with decorators are defined on this method just before the server starts listening for requests
   */
  listen: (cb?: ServerListenCallback) => void;
  /**
   * Closes the server and frees the port
   */
  close: () => Promise<void>;
  /**
   * Get a mock server instance, useful for testing purposes
   */
  getMockServer: () => Promise<MockServer>;
}

export type StandardMethodOptions = {
  middlewares?: ServerRouteMiddleware[] | ServerRouteMiddleware;
  swagger?: SwaggerRouteOptions;
};
