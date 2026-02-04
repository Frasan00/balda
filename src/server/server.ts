import type { Router as ExpressRouter, RequestHandler } from "express";
import { AjvStateManager } from "../ajv/ajv.js";
import { cronUi } from "../cron/cron.js";
import { RequestSchema } from "../decorators/validation/validate_types.js";
import { errorFactory } from "../errors/error_factory.js";
import { MethodNotAllowedError } from "../errors/method_not_allowed.js";
import { RouteNotFoundError } from "../errors/route_not_found.js";
import { GraphQL } from "../graphql/graphql.js";
import { logger } from "../logger/logger.js";
import { MockServer } from "../mock/mock_server.js";
import { asyncLocalStorage } from "../plugins/async_local_storage/async_local_storage.js";
import type { AsyncLocalStorageContextSetters } from "../plugins/async_local_storage/async_local_storage_types.js";
import { bodyParser } from "../plugins/body_parser/body_parser.js";
import type { BodyParserOptions } from "../plugins/body_parser/body_parser_types.js";
import { compression } from "../plugins/compression/compression.js";
import type { CompressionOptions } from "../plugins/compression/compression_types.js";
import { cookie } from "../plugins/cookie/cookie.js";
import type { CookieMiddlewareOptions } from "../plugins/cookie/cookie_types.js";
import { cors } from "../plugins/cors/cors.js";
import type { CorsOptions } from "../plugins/cors/cors_types.js";
import {
  createExpressAdapter,
  expressMiddleware,
  mountExpressRouter,
} from "../plugins/express/express.js";
import { helmet } from "../plugins/helmet/helmet.js";
import type { HelmetOptions } from "../plugins/helmet/helmet_types.js";
import { log } from "../plugins/log/log.js";
import type { LogOptions } from "../plugins/log/log_types.js";
import { methodOverride } from "../plugins/method_override/method_override.js";
import type { MethodOverrideOptions } from "../plugins/method_override/method_override_types.js";
import { rateLimiter } from "../plugins/rate_limiter/rate_limiter.js";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "../plugins/rate_limiter/rate_limiter_types.js";
import { session } from "../plugins/session/session.js";
import type { SessionOptions } from "../plugins/session/session_types.js";
import { serveStatic } from "../plugins/static/static.js";
import type { StaticPluginOptions } from "../plugins/static/static_types.js";
import { swagger } from "../plugins/swagger/swagger.js";
import type { SwaggerRouteOptions } from "../plugins/swagger/swagger_types.js";
import { timeout as timeoutMw } from "../plugins/timeout/timeout.js";
import type { TimeoutOptions } from "../plugins/timeout/timeout_types.js";
import { trustProxy } from "../plugins/trust_proxy/trust_proxy.js";
import type { TrustProxyOptions } from "../plugins/trust_proxy/trust_proxy_types.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { NativeEnv } from "../runtime/native_env.js";
import { nativeExit } from "../runtime/native_exit.js";
import { nativeFs } from "../runtime/native_fs.js";
import { hash as nativeHash } from "../runtime/native_hash.js";
import { nativePath } from "../runtime/native_path.js";
import { ServerConnector } from "../runtime/native_server/server_connector.js";
import type {
  HttpsServerOptions,
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
} from "../runtime/native_server/server_types.js";
import { runtime } from "../runtime/runtime.js";
import type { SyncOrAsync } from "../type_util.js";
import { router } from "./router/router.js";
import type { ClientRouter, Route } from "./router/router_type.js";
import type {
  ControllerHandler,
  NodeHttpClient,
  ResolvedServerOptions,
  ServerErrorHandler,
  ServerInterface,
  ServerOptions,
  ServerPlugin,
  SignalEvent,
  StandardMethodOptions,
  GetMethodOptions,
  CacheRouteOptions,
} from "./server_types.js";
import { buildCacheKey } from "../cache/route_cache.js";
import { Request } from "./http/request.js";
import { Response } from "./http/response.js";
import { executeMiddlewareChain } from "../runtime/native_server/server_utils.js";

/**
 * The server class that is used to create and manage the server
 */
export class Server<
  H extends NodeHttpClient = NodeHttpClient,
> implements ServerInterface {
  readonly _brand = "BaldaServer" as const;
  readonly serverOptions: ResolvedServerOptions;
  readonly router: ClientRouter = router;
  readonly #nativeEnv: NativeEnv = new NativeEnv();
  private readonly logger = logger.child({ scope: "Server" });

  isListening: boolean;
  isProduction: boolean;
  graphql: GraphQL;

  #wasInitialized: boolean;
  #serverConnector: ServerConnector;
  #globalMiddlewares: ServerRouteMiddleware[] = [];
  #controllerImportBlacklistedPaths: string[] = ["node_modules"];
  #notFoundHandler?: ServerRouteHandler;
  #httpsOptions?: HttpsServerOptions;

  /**
   * The constructor for the server
   * @warning Routes will only be defined after calling the `listen` method so you're free to define middlewares before calling it
   * @param options - The options for the server
   * @param options.port - The port to listen on, if not provided, it will use the PORT environment variable, if not provided, it will default to 80
   * @param options.host - The hostname to listen on, if not provided, it will use the HOST environment variable, if not provided, it will default to 0.0.0.0
   * @param options.controllerPatterns - The patterns to match for controllers, defaults to an empty array
   * @param options.plugins - The plugins to apply to the server, by default no plugins are applied, plugins are applied in the order they are defined in the options
   * @param options.logger - The logger to use for the server, by default a default logger is used
   * @param options.tapOptions - Options fetch to the runtime server before the server is up and running
   * @param options.abortSignal - An optional AbortSignal to gracefully shutdown the server when aborted
   */
  constructor(options?: ServerOptions<H>) {
    this.#wasInitialized = false;
    this.serverOptions = {
      nodeHttpClient: options?.nodeHttpClient ?? ("http" as H),
      port: options?.port ?? Number(this.#nativeEnv.get("PORT")) ?? 80,
      host: options?.host ?? this.#nativeEnv.get("HOST") ?? "0.0.0.0",
      controllerPatterns: options?.controllerPatterns ?? [],
      plugins: options?.plugins ?? {},
      tapOptions: options?.tapOptions ?? ({} as ServerTapOptions),
      swagger: options?.swagger ?? true,
      graphql: options?.graphql ?? undefined,
      abortSignal: options?.abortSignal,
      cronUI: options?.cronUI,
      cache: options?.cache,
    };

    if (options?.ajvInstance) {
      AjvStateManager.setGlobalInstance(options.ajvInstance);
    }

    this.#httpsOptions =
      options?.nodeHttpClient === "https" ||
      options?.nodeHttpClient === "http2-secure"
        ? (options as ServerOptions<"https">).httpsOptions
        : undefined;

    this.isListening = false;
    this.isProduction = this.#nativeEnv.get("NODE_ENV") === "production";
    this.graphql = new GraphQL(this.serverOptions.graphql);

    this.#serverConnector = new ServerConnector({
      routes: [],
      port: this.serverOptions.port,
      host: this.serverOptions.host,
      tapOptions: this.serverOptions.tapOptions,
      runtime: runtime.type,
      nodeHttpClient: this.serverOptions.nodeHttpClient,
      httpsOptions: this.#httpsOptions,
      graphql: this.graphql,
      cacheAdapter: options?.cache?.adapter,
    });

    this.setupAbortSignalHandler();
  }

  get protectedKeys(): string[] {
    const own = Object.getOwnPropertyNames(this);
    const proto = Object.getPrototypeOf(this);
    const protoNames = proto ? Object.getOwnPropertyNames(proto) : [];
    return Array.from(new Set([...own, ...protoNames]));
  }

  get url(): string {
    return this.#serverConnector.url;
  }

  get port(): number {
    return this.#serverConnector.port;
  }

  get host(): string {
    return this.#serverConnector.host;
  }

  get routes(): Route[] {
    return router.getRoutes() || [];
  }

  get fs(): typeof nativeFs {
    return nativeFs;
  }

  async hash(data: string): Promise<string> {
    return nativeHash.hash(data);
  }

  async compareHash(hash: string, data: string): Promise<boolean> {
    return nativeHash.compare(hash, data);
  }

  getEnvironment(): Record<string, string> {
    return this.#nativeEnv.getEnvironment();
  }

  tmpDir(...append: string[]): string {
    const baseTmpDir = "tmp";
    return nativePath.join(baseTmpDir, ...append);
  }

  get<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  get<TPath extends string = string>(
    path: TPath,
    options: GetMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  get<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: GetMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions, cache } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "GET",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
      cache,
    );
  }

  post<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  post<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  post<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "POST",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  patch<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  patch<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  patch<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "PATCH",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  put<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  put<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  put<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "PUT",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  delete<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  delete<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  delete<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "DELETE",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  options<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  options<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  options<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "OPTIONS",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  head<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<TPath>,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: ControllerHandler<TPath>,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    optionsOrHandler: StandardMethodOptions | ControllerHandler<TPath>,
    maybeHandler?: ControllerHandler<TPath>,
  ): void {
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    const validationSchemas = { body, query, all };
    router.addOrUpdate(
      "HEAD",
      path,
      middlewares,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  group(
    path: string,
    middleware: ServerRouteMiddleware[] | ServerRouteMiddleware,
    cb: (router: ClientRouter) => void,
  ): void;
  group(path: string, cb: (router: ClientRouter) => void): void;
  group(
    path: string,
    middlewareOrCb:
      | ServerRouteMiddleware[]
      | ServerRouteMiddleware
      | ((router: ClientRouter) => void),
    maybeCb?: (router: ClientRouter) => void,
  ): void {
    this.router.group(
      path,
      middlewareOrCb as ServerRouteMiddleware[] | ServerRouteMiddleware,
      maybeCb as (router: ClientRouter) => void,
    );
  }

  getNodeServer(): RuntimeServerMap<"node", H> {
    if (runtime.type !== "node") {
      throw new Error(
        "Server is not using node runtime, you can't call `.getNodeServer()`",
      );
    }

    return this.#serverConnector.getServer("node") as RuntimeServerMap<
      "node",
      H
    >;
  }

  getBunServer(): RuntimeServerMap<"bun"> {
    if (runtime.type !== "bun") {
      throw new Error(
        "Server is not using bun runtime, you can't call `.getBunServer()`",
      );
    }

    return this.#serverConnector.getServer("bun");
  }

  getDenoServer(): RuntimeServerMap<"deno"> {
    if (runtime.type !== "deno") {
      throw new Error(
        "Server is not using deno runtime, you can't call `.getDenoServer()`",
      );
    }

    return this.#serverConnector.getServer("deno");
  }

  embed(key: string, value: any): void {
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(
        `Invalid key provided to embed: ${key}. Key must be a non-empty string.`,
      );
    }

    if (this.protectedKeys.includes(key) || key === "constructor") {
      throw new Error(
        `Cannot embed value with key '${key}' as it conflicts with a protected server property`,
      );
    }

    Object.defineProperty(this, key, {
      value,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }

  exit(code: number = 0): void {
    nativeExit.exit(code);
  }

  on(event: SignalEvent, cb: () => SyncOrAsync): void;
  on(event: string, cb: () => SyncOrAsync): void;
  on(event: SignalEvent | string, cb: () => SyncOrAsync): void {
    switch (runtime.type) {
      case "bun":
      case "node":
        process.on(event, cb);
        break;
      case "deno":
        Deno.addSignalListener(event as Deno.Signal, cb);
        break;
      default:
        throw new Error(
          `Unsupported runtime: ${runtime.type}, only node, bun and deno are supported`,
        );
    }
  }

  once(event: SignalEvent, cb: () => SyncOrAsync): void;
  once(event: string, cb: () => SyncOrAsync): void;
  once(event: SignalEvent | string, cb: () => SyncOrAsync): void {
    switch (runtime.type) {
      case "bun":
      case "node":
        process.once(event, cb);
        break;
      case "deno":
        Deno.addSignalListener(event as Deno.Signal, cb);
        break;
      default:
        throw new Error(
          `Unsupported runtime: ${runtime.type}, only node, bun and deno are supported`,
        );
    }
  }

  use(...middlewares: ServerRouteMiddleware[]): void {
    this.#globalMiddlewares.push(...middlewares);
  }

  useExpress(
    pathOrMiddleware: string | RequestHandler | ExpressRouter,
    maybeMiddleware?: RequestHandler | ExpressRouter,
  ): void {
    const adapter = createExpressAdapter(this);
    adapter.use(pathOrMiddleware, maybeMiddleware);
  }

  expressMiddleware(middleware: RequestHandler): ServerRouteMiddleware {
    return expressMiddleware(middleware);
  }

  mountExpressRouter(basePath: string, expressRouter: ExpressRouter): void {
    mountExpressRouter(basePath, expressRouter);
  }

  setErrorHandler(errorHandler?: ServerErrorHandler): void {
    this.#globalMiddlewares.unshift(async (req, res, next) => {
      try {
        await next();
      } catch (error) {
        await errorHandler?.(req, res, next, error as Error);
      }
    });
  }

  setNotFoundHandler(notFoundHandler?: ServerRouteHandler): void {
    this.#notFoundHandler = notFoundHandler?.bind(this);
  }

  listen(cb?: ServerListenCallback): void {
    if (this.isListening) {
      throw new Error(
        "Server is already listening, you can't call `.listen()` multiple times",
      );
    }

    const baseData = {
      port: this.port,
      host: this.host,
      url: this.url,
    };

    this.bootstrap()
      .then(() => {
        this.#serverConnector.listen();
        this.isListening = true;

        cb?.({
          err: null,
          ...baseData,
        });
      })
      .catch((err) => {
        cb?.({
          err,
          ...baseData,
        });
      });
  }

  async waitUntilListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.listen(() => {
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Closes the server and frees the port
   * This method is idempotent and can be called multiple times safely
   * @returns A promise that resolves when the server is closed
   */
  async close(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Disconnects the server and frees the port
   * This method is idempotent and can be called multiple times safely
   * Subsequent calls after the first will have no effect
   * @returns A promise that resolves when the server is disconnected
   */
  async disconnect(): Promise<void> {
    if (!this.isListening) {
      this.logger.warn(
        "Trying to disconnect the server that is not listening, ignoring",
      );
      return;
    }

    try {
      await this.#serverConnector.close();
    } catch (error) {
      this.logger.error({ error }, "Error closing server connector");
      throw error;
    } finally {
      this.isListening = false;
    }
  }

  configureHash(options: {
    iterations?: number;
    saltLength?: number;
    keyLength?: number;
  }): void {
    nativeHash.configure(options);
  }

  async getMockServer(
    options?: Pick<ServerOptions, "controllerPatterns">,
  ): Promise<MockServer> {
    await this.bootstrap(options);
    return new MockServer(this);
  }

  private async importControllers(
    customControllerPatterns?: string[],
  ): Promise<void> {
    const controllerPatterns =
      customControllerPatterns ?? this.serverOptions.controllerPatterns;

    // Skip controller import if no patterns provided
    if (!controllerPatterns || controllerPatterns.length === 0) {
      return;
    }

    try {
      const { glob } = await import("glob");

      let controllerPaths = await Promise.all(
        controllerPatterns.map(async (pattern) => {
          return glob(pattern, {
            absolute: true,
            cwd: nativeCwd.getCwd(),
          });
        }),
      ).then((paths) => paths.flat());

      controllerPaths = controllerPaths.flat();
      controllerPaths = controllerPaths.filter(
        (path) =>
          !this.#controllerImportBlacklistedPaths.some((blacklistedPath) =>
            path.includes(blacklistedPath),
          ),
      );

      this.logger.debug(
        `Found ${controllerPaths.length} controllers to import`,
      );
      await Promise.all(
        controllerPaths.map(async (controllerPath) => {
          this.logger.debug(`Importing controller ${controllerPath}`);
          await import(controllerPath).catch((err) => {
            this.logger.error(
              `Error importing controller ${controllerPath}: ${err}`,
            );
          });
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not auto-import controllers: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private extractOptionsAndHandlerFromRouteRegistration(
    optionsOrHandler:
      | StandardMethodOptions
      | GetMethodOptions
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): {
    middlewares: ServerRouteMiddleware[];
    handler: ServerRouteHandler;
    body?: RequestSchema;
    query?: RequestSchema;
    all?: RequestSchema;
    swaggerOptions?: SwaggerRouteOptions;
    cache?: CacheRouteOptions;
  } {
    if (typeof optionsOrHandler === "function") {
      // Handler only
      return {
        middlewares: [],
        handler: optionsOrHandler as ServerRouteHandler,
        swaggerOptions: undefined,
      };
    }

    // StandardMethodOptions or GetMethodOptions
    const options = optionsOrHandler as GetMethodOptions;
    const middlewares = Array.isArray(options.middlewares)
      ? options.middlewares
      : options.middlewares
        ? [options.middlewares]
        : [];

    return {
      middlewares,
      handler: maybeHandler!,
      body: options.body,
      query: options.query,
      all: options.all,
      swaggerOptions: options.swagger,
      cache: options.cache,
    };
  }

  private applyPlugins(plugins: ServerPlugin): void {
    Object.entries(plugins).forEach(([pluginName, pluginOptions]) => {
      switch (pluginName as keyof ServerPlugin) {
        case "bodyParser":
          this.use(bodyParser(pluginOptions as BodyParserOptions));
          break;
        case "cors":
          this.use(cors(pluginOptions as CorsOptions));
          break;
        case "static":
          this.use(serveStatic(pluginOptions as StaticPluginOptions));
          break;
        case "helmet":
          this.use(helmet(pluginOptions as HelmetOptions));
          break;
        case "cookie":
          this.use(cookie(pluginOptions as CookieMiddlewareOptions));
          break;
        case "methodOverride":
          this.use(methodOverride(pluginOptions as MethodOverrideOptions));
          break;
        case "compression":
          this.use(compression(pluginOptions as CompressionOptions));
          break;
        case "log":
          this.use(log(pluginOptions as LogOptions));
          break;
        case "rateLimiter":
          const { keyOptions, storageOptions } = pluginOptions as {
            keyOptions?: RateLimiterKeyOptions;
            storageOptions?: StorageOptions;
          };

          this.use(rateLimiter(keyOptions, storageOptions));
          break;
        case "trustProxy":
          this.use(trustProxy(pluginOptions as TrustProxyOptions));
          break;
        case "timeout":
          this.use(timeoutMw(pluginOptions as TimeoutOptions));
          break;
        case "session":
          this.use(session(pluginOptions as SessionOptions));
          break;
        case "asyncLocalStorage":
          this.use(
            asyncLocalStorage(pluginOptions as AsyncLocalStorageContextSetters),
          );
          break;
        default:
          this.logger.warn(`Unknown plugin ${pluginName}`);
          break;
      }
    });
  }

  /**
   * Initializes the server by importing the controllers and applying the plugins, it's idempotent, it will not re-import the controllers or apply the plugins if the server was already initialized (e.g. mockServer init)
   * @internal
   */
  private async bootstrap(
    options?: Pick<ServerOptions, "controllerPatterns">,
  ): Promise<void> {
    if (this.#wasInitialized) {
      return;
    }

    await this.importControllers(options?.controllerPatterns);
    this.applyPlugins(this.serverOptions.plugins);

    if (this.serverOptions.cronUI) {
      await cronUi(this.serverOptions.cronUI);
    }

    if (this.serverOptions.swagger) {
      swagger(this.serverOptions.swagger);
    }

    this.registerNotFoundRoutes();
    if (this.#globalMiddlewares.length) {
      router.applyGlobalMiddlewaresToAllRoutes(this.#globalMiddlewares);
    }

    this.#wasInitialized = true;
  }

  /**
   * Handles not found routes by delegating to custom handler or default error response
   * Checks if the path exists for other methods and returns 405 if so
   * @internal
   */
  private handleNotFound: ServerRouteHandler = (req, res) => {
    if (this.#notFoundHandler) {
      this.#notFoundHandler(req, res);
      return;
    }

    const pathname = new URL(req.url).pathname;
    const allMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
    const allowedMethods: string[] = [];

    for (const method of allMethods) {
      if (method === req.method.toUpperCase()) {
        continue;
      }

      const match = router.find(method, pathname);
      if (match && match.handler !== this.handleNotFound) {
        allowedMethods.push(method);
      }
    }

    if (allowedMethods.length) {
      res.setHeader("Allow", allowedMethods.join(", "));
      const methodNotAllowedError = new MethodNotAllowedError(
        pathname,
        req.method,
      );

      res.methodNotAllowed({
        ...errorFactory(methodNotAllowedError),
      });

      return;
    }

    const notFoundError = new RouteNotFoundError(pathname, req.method);
    res.notFound({
      ...errorFactory(notFoundError),
    });
  };

  /**
   * Registers a not found route for all routes that are not defined
   * @internal
   */
  private registerNotFoundRoutes(): void {
    const methods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ] as const;
    for (const method of methods) {
      router.addOrUpdate(
        method,
        "*",
        [],
        this.handleNotFound,
        {},
        {
          excludeFromSwagger: true,
        },
      );
    }
  }

  /**
   * Warm up cache for a static GET route by executing the handler and storing the result
   * @param method - HTTP method (should be "GET")
   * @param path - Route path (e.g. "/users/profiles")
   * @param query - Optional query parameters
   */
  async warmCache(
    method: string,
    path: string,
    query?: Record<string, string>,
  ): Promise<void> {
    const cacheAdapter =
      this.serverOptions?.cache?.adapter ??
      (this.constructor as any).cache?.adapter;

    if (!cacheAdapter) {
      this.logger.warn("No cache adapter configured, cannot warm cache");
      return;
    }

    const match = router.find(method, path);
    if (!match) {
      throw new Error(`No route found for ${method} ${path}`);
    }

    if (method !== "GET" && method.toUpperCase() !== "GET") {
      throw new Error("Cache warm-up is only supported for GET routes");
    }

    if (!match.cacheOptions) {
      throw new Error(
        `Route ${method} ${path} does not have cache options enabled`,
      );
    }

    // Build cache key
    const key =
      match.cacheOptions.key ??
      buildCacheKey(method, match.path!, match.params, query ?? {}, {
        includeQuery: match.cacheOptions.includeQuery ?? false,
        includeHeaders: match.cacheOptions.includeHeaders ?? false,
        headers: match.cacheOptions.includeHeaders ? {} : undefined,
      });

    // Create mock request and response
    const request = new Request();
    request.method = method;
    request.url = path;
    request.params = match.params;
    if (query) {
      const queryString = new URLSearchParams(query).toString();
      request.setQueryString(queryString);
    }

    const response = new Response();
    response.setRouteResponseSchemas(match.responseSchemas);

    // Execute middleware chain
    await executeMiddlewareChain(
      match.middleware,
      match.handler,
      request,
      response,
    );

    // Store in cache
    const payload = {
      status: response.responseStatus,
      headers: { ...response.headers },
      body: response.getBody(),
    };

    await cacheAdapter.set(key, payload, match.cacheOptions.ttl);
    this.logger.debug({ key, method, path }, "Cache warmed up");
  }

  /**
   * Invalidate a specific cache key
   * @param key - Cache key to invalidate
   */
  async invalidateCache(key: string): Promise<void> {
    const cacheAdapter =
      this.serverOptions?.cache?.adapter ??
      (this.constructor as any).cache?.adapter;

    if (!cacheAdapter) {
      this.logger.warn("No cache adapter configured, cannot invalidate cache");
      return;
    }

    await cacheAdapter.invalidate(key);
    this.logger.debug({ key }, "Cache invalidated");
  }

  /**
   * Invalidate all cache keys starting with the given prefix
   * @param prefix - Cache key prefix to invalidate
   */
  async invalidateCachePrefix(prefix: string): Promise<void> {
    const cacheAdapter =
      this.serverOptions?.cache?.adapter ??
      (this.constructor as any).cache?.adapter;

    if (!cacheAdapter) {
      this.logger.warn("No cache adapter configured, cannot invalidate cache");
      return;
    }

    await cacheAdapter.invalidateAll(prefix);
    this.logger.debug({ prefix }, "Cache prefix invalidated");
  }

  /**
   * Sets up the abort signal handler to gracefully shutdown the server when aborted
   * @internal
   */
  private setupAbortSignalHandler(): void {
    if (!this.serverOptions.abortSignal) {
      return;
    }

    const signal = this.serverOptions.abortSignal;

    if (signal.aborted) {
      this.logger.warn(
        "AbortSignal was already aborted, server will not start",
      );
      return;
    }

    signal.addEventListener("abort", async () => {
      this.logger.info("AbortSignal received, shutting down server gracefully");
      try {
        await this.disconnect();
        this.logger.info("Server shutdown completed");
      } catch (error) {
        this.logger.error(
          { error },
          "Error during server shutdown from abort signal",
        );
      }
    });
  }
}
