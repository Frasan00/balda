import type { Ajv } from "ajv";
import type { RequestHandler } from "express";
import type { Logger } from "pino";
import type { GraphQLOptions } from "../graphql/graphql_types.js";
import type { MockServer } from "../mock/mock_server.js";
import { AsyncLocalStorageContextSetters } from "../plugins/async_local_storage/async_local_storage_types.js";
import type { BodyParserOptions } from "../plugins/body_parser/body_parser_types.js";
import type { CompressionOptions } from "../plugins/compression/compression_types.js";
import type { CookieMiddlewareOptions } from "../plugins/cookie/cookie_types.js";
import type { CorsOptions } from "../plugins/cors/cors_types.js";
import type { ExpressRouter } from "../plugins/express/express_types.js";
import type { HelmetOptions } from "../plugins/helmet/helmet_types.js";
import type { LogOptions } from "../plugins/log/log_types.js";
import type { MethodOverrideOptions } from "../plugins/method_override/method_override_types.js";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "../plugins/rate_limiter/rate_limiter_types.js";
import type { SessionOptions } from "../plugins/session/session_types.js";
import type { StaticPluginOptions } from "../plugins/static/static_types.js";
import type { swagger } from "../plugins/swagger/swagger.js";
import type { SwaggerRouteOptions } from "../plugins/swagger/swagger_types.js";
import type { TimeoutOptions } from "../plugins/timeout/timeout_types.js";
import type { TrustProxyOptions } from "../plugins/trust_proxy/trust_proxy_types.js";
import type {
  HttpsOptions,
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
} from "../runtime/native_server/server_types.js";
import { SyncOrAsync } from "../type_util.js";
import type { NextFunction } from "./http/next.js";
import type { Request } from "./http/request.js";
import type { Response } from "./http/response.js";
import type { ClientRouter } from "./router/router_type.js";
import type { CronUIOptions } from "../cron/cron.types.js";
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import { ExtractParams } from "./router/path_types.js";
import { nativeFs } from "../runtime/native_fs.js";

export type ServerHandlerReturnType = any | Promise<any>;

export type ServerPlugin = {
  bodyParser?: BodyParserOptions;
  cors?: CorsOptions;
  static?: StaticPluginOptions;
  helmet?: HelmetOptions;
  cookie?: CookieMiddlewareOptions;
  log?: LogOptions;
  rateLimiter?: {
    keyOptions?: RateLimiterKeyOptions;
    storageOptions?: StorageOptions;
  };
  trustProxy?: TrustProxyOptions;
  timeout?: TimeoutOptions;
  session?: SessionOptions;
  methodOverride?: MethodOverrideOptions;
  compression?: CompressionOptions;
  asyncLocalStorage?: AsyncLocalStorageContextSetters;
};

export type NodeHttpClient = "http" | "http2" | "https" | "http2-secure";

export type ServerOptions<H extends NodeHttpClient = NodeHttpClient> = {
  /** Specific node client to use for nodejs, default to `http` */
  nodeHttpClient?: H;
  /** The port to listen on, uses the PORT env if present, defaults to 80 */
  port?: number;
  /** The hostname to listen on, uses the HOST env if present, defaults to 0.0.0.0 */
  host?: string;
  /** Controller patterns to match, defaults to an empty array */
  controllerPatterns?: string[];
  /** Basic plugins to apply to all requests, plugins are applied in order based on where they are defined in the `plugins` object, by default no plugins are applied */
  plugins?: ServerPlugin;
  /** The tap options to interact with the underlying server connector before it is used to listen for incoming requests */
  tapOptions?: ServerTapOptions;
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
  /**
   * The graphql options to apply to the server, by default graphql plugin is not enabled, you can pass a boolean to enable or disable the plugin or you can pass an object to apply custom options to the plugin (when options are provided the plugin is always enabled)
   * @example
   * ```ts
   * const server = new Server({
   *   graphql: true,
   * });
   * ```
   * @example
   * ```ts
   * const server = new Server({
   *   graphql: {
   *     schema: createSchema({ typeDefs: `type Query { hello: String }`, resolvers: { Query: { hello: () => 'Hello World' } } }),
   *   },
   * });
   * ```
   */
  graphql?: GraphQLOptions;
  /**
   * Custom AJV instance to use for the server for validation, by default a global instance is used, you can pass a custom instance to use for the server validation
   * @example
   * ```ts
   * const server = new Server({
   *   ajvInstance: new Ajv(),
   * });
   * ```
   */
  ajvInstance?: Ajv;
  /**
   * Custom Pino logger instance for the server. If not provided, the default internal logger is used.
   * @example
   * ```ts
   * import pino from "pino";
   * const server = new Server({
   *   logger: pino({ level: "debug" }),
   * });
   * ```
   */
  logger?: Logger;
  /**
   * An AbortSignal to gracefully shutdown the server when aborted
   * @example
   * ```ts
   * const controller = new AbortController();
   * const server = new Server({
   *   abortSignal: controller.signal,
   * });
   *
   * await server.waitUntilListening();
   *
   * // Later: abort the server
   * controller.abort();
   * ```
   */
  abortSignal?: AbortSignal;
  /**
   * The cronUI options to apply to the server.
   * By passing the "path" option, the UI will be enabled at the given path.
   */
  cronUI?: CronUIOptions;
} & (H extends "https" | "http2-secure" ? HttpsOptions<H> : {});

/** Internal resolved server options with all required properties */
export type ResolvedServerOptions = {
  nodeHttpClient: NodeHttpClient;
  port: number;
  host: string;
  controllerPatterns: string[];
  plugins: ServerPlugin;
  tapOptions: ServerTapOptions;
  swagger: Parameters<typeof swagger>[0] | boolean;
  graphql?: GraphQLOptions;
  abortSignal?: AbortSignal;
  cronUI?: CronUIOptions;
};

export type ServerErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  error: Error,
) => SyncOrAsync;

export interface ServerInterface {
  /**
   * Identifier for the balda server instance
   */
  _brand: "BaldaServer";
  /**
   * Whether the server is in production mode NODE_ENV is set to "production"
   */
  isProduction: boolean;
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
   * Server options passed to the constructor
   */
  serverOptions: ResolvedServerOptions;

  /**
   * Main singleton router instance of the server
   */
  router: ClientRouter;

  /**
   * Hash the given data using the native hash function of the current runtime
   * @param data - The data to hash
   * @returns The hashed data
   */
  hash: (data: string) => Promise<string>;

  /**
   * Compare the given data with the given hash using the native hash function of the current runtime
   * @param hash - The hash to compare the data with
   * @param data - The data to compare with the hash
   * @returns Whether the data matches the hash
   */
  compareHash: (hash: string, data: string) => Promise<boolean>;

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
   * The filesystem module of the server, uses the native apis from the current runtime
   */
  fs: typeof nativeFs;

  /**
   * Mount an Express middleware or router at a specific path for compatibility with Express-based libraries like AdminJS
   * @param pathOrMiddleware - The path to mount at, or the Express middleware/router if mounting at root
   * @param maybeMiddleware - The Express middleware or router when path is provided
   */
  useExpress: (
    pathOrMiddleware: string | RequestHandler | ExpressRouter,
    maybeMiddleware?: RequestHandler | ExpressRouter,
  ) => void;

  /**
   * Convert an Express middleware to a Balda-compatible middleware
   * @param middleware - The Express middleware to convert
   * @returns A Balda-compatible middleware
   */
  expressMiddleware: (middleware: RequestHandler) => ServerRouteMiddleware;

  /**
   * Mount an Express router at a specific base path
   * @param basePath - The base path to mount the router at
   * @param expressRouter - The Express router to mount
   */
  mountExpressRouter: (basePath: string, expressRouter: ExpressRouter) => void;

  /**
   * Shorthand for the router.get method
   */
  get: (...args: any[]) => void;

  /**
   * Shorthand for the router.post method
   */
  post: (...args: any[]) => void;

  /**
   * Shorthand for the router.put method
   */
  put: (...args: any[]) => void;

  /**
   * Shorthand for the router.patch method
   */
  patch: (...args: any[]) => void;

  /**
   * Shorthand for the router.delete method
   */
  delete: (...args: any[]) => void;

  /**
   * Shorthand for the router.options method
   */
  options: (...args: any[]) => void;

  /**
   * Shorthand for the router.head method
   */
  head: (...args: any[]) => void;

  /**
   * Shorthand for the router.group method
   */
  group: (...args: any[]) => void;

  /**
   * Get the node server instance, you must be using node runtime to use this method based on the nodeHttpClient option passed to the server constructor (defaults to http)
   * @throws if the runtime is not node
   */
  getNodeServer: () => RuntimeServerMap<"node", NodeHttpClient>;

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
   *   interface Server {
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
  on: (event: SignalEvent, cb: () => SyncOrAsync) => void;

  /**
   * Register a signal event listener to the server, this is useful for handling signals like SIGINT, SIGTERM, etc.
   * @param event - The signal event to listen for
   * @param cb - The callback to be called when the signal event is received
   */
  once: (event: SignalEvent, cb: () => SyncOrAsync) => void;

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
   * Sets a custom handler for 404 Not Found responses.
   * If not set, the default RouteNotFoundError will be used.
   *
   * @param notFoundHandler - Optional handler to customize 404 responses
   * @example
   * server.setNotFoundHandler((req, res) => {
   *   res.status(404).json({ error: "Custom not found message" });
   * });
   */
  setNotFoundHandler: (notFoundHandler?: ServerRouteHandler) => void;
  /**
   * Register a hook to be called after bootstrap (controllers imported, plugins applied) but before the server starts accepting requests.
   * Multiple hooks are called in the order they are registered.
   * @param hook - The hook function to call, can be sync or async
   * @example
   * ```ts
   * server.beforeStart(async () => {
   *   await connectToDatabase();
   * });
   * ```
   */
  beforeStart: (hook: ServerHook) => void;
  /**
   * Binds the server to the port and hostname defined in the serverOptions, meant to be called only once
   * It initializes the server without blocking the event loop, you can pass a callback to be called when the server is listening
   * Use `waitUntilListening` instead if you want to wait for the server to be listening for requests before returning
   * @warning All routes defined with decorators are defined on this method just before the server starts listening for requests
   */
  listen: (cb?: ServerListenCallback) => void;
  /**
   * Binds the server to the port and hostname defined in the serverOptions, meant to be called only once
   * It initializes the server blocking the event loop, it will wait for the server to be listening for requests before returning
   * Use `listen` instead if you want to initialize the server without blocking the event loop
   * @warning All routes defined with decorators are defined on this method just before the server starts listening for requests
   */
  waitUntilListening: () => Promise<void>;
  /**
   * Closes the server and frees the port
   * This method is idempotent and can be called multiple times safely
   * @alias disconnect
   */
  close: () => Promise<void>;
  /**
   * Disconnects the server and frees the port
   * This method is idempotent and can be called multiple times safely
   * Subsequent calls after the first will have no effect
   */
  disconnect: () => Promise<void>;
  /**
   * Configure hash settings for password hashing
   * @param options - Hash configuration options
   * @param options.iterations - Number of PBKDF2 iterations (default: 600,000)
   * @param options.saltLength - Salt length in bytes (default: 16)
   * @param options.keyLength - Key length in bits (default: 256)
   */
  configureHash: (options: {
    iterations?: number;
    saltLength?: number;
    keyLength?: number;
  }) => void;
  /**
   * Returns a mock server instance that can be used to test the server without starting it
   * It will import the controllers and apply the plugins to the mock server
   * @param options - The options for the mock server
   * @param options.controllerPatterns - Custom controller patterns to import if the mock server must not be initialized with the same controller patterns as the server
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
}

export type StandardMethodOptions = {
  middlewares?: ServerRouteMiddleware[] | ServerRouteMiddleware;
  body?: RequestSchema;
  query?: RequestSchema;
  all?: RequestSchema;
  swagger?: SwaggerRouteOptions;
};

export type ServerHook = () => SyncOrAsync;

export type SignalEvent = Deno.Signal | NodeJS.Signals;

export type ControllerHandler<TPath extends string = string> = (
  req: Request<ExtractParams<TPath>>,
  res: Response,
  ...args: any[]
) => ServerHandlerReturnType;
