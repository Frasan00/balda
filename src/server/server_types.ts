import type { CronService } from "src/cron/cron";
import type { MockServer } from "src/mock/mock_server";
import type { CookieMiddlewareOptions } from "src/plugins/cookie/cookie_types";
import type { FilePluginOptions } from "src/plugins/file/file_types";
import type { HelmetOptions } from "src/plugins/helmet/helmet_types";
import type { LogOptions } from "src/plugins/log/log_types";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "src/plugins/rate_limiter/rate_limiter_types";
import type { SessionOptions } from "src/plugins/session/session_types";
import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import type { TimeoutOptions } from "src/plugins/timeout/timeout_types";
import type { TrustProxyOptions } from "src/plugins/trust_proxy/trust_proxy_types";
import type { UrlEncodedOptions } from "src/plugins/urlencoded/urlencoded_types";
import type { CorsOptions } from "../plugins/cors/cors_types";
import type { JsonOptions } from "../plugins/json/json_options";
import type { swagger } from "../plugins/swagger/swagger";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
} from "../runtime/native_server/server_types";
import type { NextFunction } from "./http/next";
import type { Response } from "./http/response";
import type { ClientRouter } from "src/server/router/router_type";

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
  trustProxy?: TrustProxyOptions;
  timeout?: TimeoutOptions;
  session?: SessionOptions;
};

export interface ServerOptions {
  /** The port to listen on, defaults to 80 */
  port?: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host?: string;
  /** Controller patterns to match, defaults to an empty array */
  controllerPatterns?: string[];
  /** Basic plugins to apply to the server, by default no plugins are applied */
  plugins?: ServerPlugin;
  /** The tap options to interact with the underlying server connector before it is used to listen for incoming requests */
  tapOptions?: ServerTapOptions;
  /** Whether to use the body parser plugin, by default it is true, it is really recommended to use it */
  useBodyParser?: boolean;
  /**
   * The swagger options to apply to the server, by default swagger plugin is applied with standard options, you can pass a boolean to enable or disable the plugin or you can pass an object to apply custom options to the plugin
   * @example
   * ```ts
   * const server = new Server({
   *   swagger: true,
   * });
   * ```
   */
  swagger?: Parameters<typeof swagger>[0] | boolean;
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
   * Main singleton router instance of the server
   */
  router: ClientRouter;

  /**
   * Get the environment variables of the server using the native environment variables of the current runtime
   */
  getEnvironment: () => Record<string, string>;

  /**
   * The path to the temporary directory, you can append a path to the temporary directory to get a new path.
   * It uses the current working directory of the runtime to get the base path.
   * @example
   * ```ts
   * server.tmpPath("my-app"); // -> ${cwd}/tmp/my-app
   * ```
   */
  tmpDir: (...append: string[]) => string;

  /**
   * Create a new directory
   * @param path - The path to the directory
   * @param options - The options to create the directory
   * @param options.recursive - Whether to create the directory recursively
   * @param options.mode - The mode of the directory
   */
  mkdir: (
    path: string,
    options?: { recursive?: boolean; mode?: number | string },
  ) => Promise<void>;

  /**
   * Shorthand for the server.router.get method
   */
  get: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.post method
   */
  post: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.put method
   */
  put: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.patch method
   */
  patch: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.delete method
   */
  delete: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.options method
   */
  options: (...args: any[]) => void;

  /**
   * Shorthand for the server.router.group method
   */
  group: (...args: any[]) => void;

  /**
   * Get the node server instance, you must be using node runtime to use this method
   * @throws if the runtime is not node
   */
  getNodeServer: () => RuntimeServerMap<"node">;

  /**
   * Get the bun server instance, you must be using bun runtime to use this method
   * @throws if the runtime is not bun
   */
  getBunServer: () => RuntimeServerMap<"bun">;

  /**
   * Get the deno server instance, you must be using deno runtime to use this method
   * @throws if the runtime is not deno
   */
  getDenoServer: () => RuntimeServerMap<"deno">;

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
   * Register a signal event listener to the server, this is useful for handling signals like SIGINT, SIGTERM, etc.
   * @param event - The signal event to listen for
   * @param cb - The callback to be called when the signal event is received
   */
  on: (event: SignalEvent, cb: () => Promise<void> | void) => void;

  /**
   * Register a signal event listener to the server, this is useful for handling signals like SIGINT, SIGTERM, etc.
   * @param event - The signal event to listen for
   * @param cb - The callback to be called when the signal event is received
   */
  once: (event: SignalEvent, cb: () => Promise<void> | void) => void;

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
   * Set the not found handler for the server
   * @param notFoundHandler - The not found handler to be applied to all routes
   */
  setNotFoundHandler: (notFoundHandler?: ServerRouteHandler) => void;
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
  /**
   * Exit current runtime process with the given code based on the current runtime
   * @param code - The code to exit with, defaults to 0
   * @example
   * ```typescript
   * server.exit(1); // If node process.exit(1) is called
   * server.exit(); // If deno Deno.exit(0) is called
   * ```
   */
  exit: (code?: number) => void;

  /**
   * Sets the global cron error handler
   * @param globalErrorHandler - The global cron error handler
   */
  setGlobalCronErrorHandler: (
    globalErrorHandler: (
      ...args: Parameters<(typeof CronService)["globalErrorHandler"]>
    ) => void,
  ) => void;

  /**
   * Starts the registered cron jobs
   * @param cronJobPatterns - The cron job patterns to that will be imported and registered before starting the cron jobs
   * @param onStart - The callback to be called when the cron jobs are started
   */
  startRegisteredCrons: (
    cronJobPatterns?: string[],
    onStart?: () => void,
  ) => Promise<void>;
}

export type StandardMethodOptions = {
  middlewares?: ServerRouteMiddleware[] | ServerRouteMiddleware;
  swagger?: SwaggerRouteOptions;
};

export type SignalEvent = Deno.Signal | NodeJS.Signals;
