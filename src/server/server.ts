import { glob } from "glob";
import { join } from "node:path";
import { CronService } from "src/cron/cron";
import { errorFactory } from "src/errors/error_factory";
import { RouteNotFoundError } from "src/errors/route_not_found";
import { MockServer } from "src/mock/mock_server";
import { cookie } from "src/plugins/cookie/cookie";
import type { CookieMiddlewareOptions } from "src/plugins/cookie/cookie_types";
import { log } from "src/plugins/log/log";
import type { LogOptions } from "src/plugins/log/log_types";
import { rateLimiter } from "src/plugins/rate_limiter/rate_limiter";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "src/plugins/rate_limiter/rate_limiter_types";
import { session } from "src/plugins/session/session";
import type { SessionOptions } from "src/plugins/session/session_types";
import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { timeout as timeoutMw } from "src/plugins/timeout/timeout";
import type { TimeoutOptions } from "src/plugins/timeout/timeout_types";
import { trustProxy } from "src/plugins/trust_proxy/trust_proxy";
import type { TrustProxyOptions } from "src/plugins/trust_proxy/trust_proxy_types";
import { urlencoded } from "src/plugins/urlencoded/urlencoded";
import type { UrlEncodedOptions } from "src/plugins/urlencoded/urlencoded_types";
import { logger } from "../logger/logger";
import { bodyParser } from "../plugins/body_parser/body_parser";
import { cors } from "../plugins/cors/cors";
import type { CorsOptions } from "../plugins/cors/cors_types";
import { fileParser } from "../plugins/file/file";
import type { FilePluginOptions } from "../plugins/file/file_types";
import { helmet } from "../plugins/helmet/helmet";
import type { HelmetOptions } from "../plugins/helmet/helmet_types";
import { json } from "../plugins/json/json";
import type { JsonOptions } from "../plugins/json/json_options";
import { serveStatic } from "../plugins/static/static";
import { swagger } from "../plugins/swagger/swagger";
import { nativeCwd } from "../runtime/native_cwd";
import { ServerConnector } from "../runtime/native_server/server_connector";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
} from "../runtime/native_server/server_types";
import { runtime } from "../runtime/runtime";
import { Router, router } from "./router/router";
import { PROTECTED_KEYS } from "./server_constants";
import type {
  ServerErrorHandler,
  ServerInterface,
  ServerOptions,
  ServerPlugin,
  SignalEvent,
  StandardMethodOptions,
} from "./server_types";
import type { ClientRouter, Route } from "src/server/router/router_type";
import { NativeEnv } from "test/native_env";

/**
 * The server class that is used to create and manage the server
 */
export class Server implements ServerInterface {
  isListening: boolean;

  readonly router: ClientRouter = router;

  private wasInitialized: boolean;
  private serverConnector: ServerConnector;
  private globalMiddlewares: ServerRouteMiddleware[] = [];
  private serverOptions: Required<ServerOptions>;
  private controllerImportBlacklistedPaths: string[] = ["node_modules"];

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
   */
  constructor(options?: ServerOptions) {
    this.wasInitialized = false;
    this.serverOptions = {
      port: options?.port ?? Number(new NativeEnv().get("PORT")) ?? 80,
      host: options?.host ?? new NativeEnv().get("HOST") ?? "0.0.0.0",
      controllerPatterns: options?.controllerPatterns ?? [],
      plugins: options?.plugins ?? {},
      tapOptions: options?.tapOptions ?? ({} as ServerTapOptions),
      swagger: options?.swagger ?? true,
      useBodyParser: options?.useBodyParser ?? true,
    };

    this.serverConnector = new ServerConnector({
      routes: [],
      port: this.serverOptions.port,
      host: this.serverOptions.host,
      tapOptions: this.serverOptions.tapOptions,
      runtime: runtime.type,
    });

    if (this.serverOptions.useBodyParser) {
      this.use(bodyParser());
    }

    this.isListening = false;
  }

  get url(): string {
    return this.serverConnector.url;
  }

  get port(): number {
    return this.serverConnector.port;
  }

  get host(): string {
    return this.serverConnector.host;
  }

  get routes(): Route[] {
    return router.getRoutes();
  }

  tmpDir(...append: string[]): string {
    const baseTmpDir = "tmp";
    if (append) {
      return join(baseTmpDir, ...append);
    }

    return join(nativeCwd.getCwd(), baseTmpDir);
  }

  get(path: string, handler: ServerRouteHandler): void;
  get(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  get(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("GET", path, middlewares, handler, swaggerOptions);
  }

  post(path: string, handler: ServerRouteHandler): void;
  post(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  post(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("POST", path, middlewares, handler, swaggerOptions);
  }

  patch(path: string, handler: ServerRouteHandler): void;
  patch(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  patch(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("PATCH", path, middlewares, handler, swaggerOptions);
  }

  put(path: string, handler: ServerRouteHandler): void;
  put(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  put(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("PUT", path, middlewares, handler, swaggerOptions);
  }

  delete(path: string, handler: ServerRouteHandler): void;
  delete(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  delete(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("DELETE", path, middlewares, handler, swaggerOptions);
  }

  options(path: string, handler: ServerRouteHandler): void;
  options(
    path: string,
    options: StandardMethodOptions,
    handler: ServerRouteHandler,
  ): void;
  options(
    path: string,
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler, swaggerOptions } =
      this.extractOptionsAndHandlerFromRouteRegistration(
        optionsOrHandler,
        maybeHandler,
      );

    router.addOrUpdate("OPTIONS", path, middlewares, handler, swaggerOptions);
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

  getNodeServer(): RuntimeServerMap<"node"> {
    if (runtime.type !== "node") {
      throw new Error(
        "Server is not using node runtime, you can't call `.getNodeServer()`",
      );
    }

    return this.serverConnector.getServer("node");
  }

  embed(key: string, value: any): void {
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(
        `Invalid key provided to embed: ${key}. Key must be a non-empty string.`,
      );
    }

    if (PROTECTED_KEYS.includes(key)) {
      throw new Error(
        `Cannot embed value with key '${key}' as it conflicts with a protected server property.`,
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
    switch (runtime.type) {
      case "bun":
      case "node":
        process.exit(code);
      case "deno":
        Deno.exit(code);
      default:
        throw new Error(`Unsupported runtime: ${runtime.type}`);
    }
  }

  on(event: SignalEvent, cb: () => void): void;
  on(event: string, cb: () => void): void;
  on(event: SignalEvent | string, cb: () => void): void {
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

  once(event: SignalEvent, cb: () => void): void;
  once(event: string, cb: () => void): void;
  once(event: SignalEvent | string, cb: () => void): void {
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
    this.globalMiddlewares.push(...middlewares);
  }

  setErrorHandler(errorHandler?: ServerErrorHandler): void {
    this.globalMiddlewares.unshift(async (req, res, next) => {
      try {
        await next();
      } catch (error) {
        await errorHandler?.(req, res, next, error as Error);
      }
    });
  }

  setGlobalCronErrorHandler(
    globalErrorHandler: (
      ...args: Parameters<(typeof CronService)["globalErrorHandler"]>
    ) => void,
  ): void {
    CronService.globalErrorHandler = globalErrorHandler;
  }

  startRegisteredCrons = async (
    cronJobPatterns?: string[],
    onStart?: () => void,
  ) => {
    if (cronJobPatterns?.length) {
      await CronService.massiveImportCronJobs(cronJobPatterns);
    }

    CronService.run().then(() => {
      onStart?.();
    });
  };

  listen(cb?: ServerListenCallback): void {
    if (this.isListening) {
      throw new Error(
        "Server is already listening, you can't call `.listen()` multiple times",
      );
    }

    this.bootstrap().then(() => {
      this.serverConnector.listen();
      this.isListening = true;
      if (this.serverOptions.swagger) {
        swagger(this.serverOptions.swagger);
      }

      cb?.({
        port: this.port,
        host: this.host,
        url: this.url,
      });
    });
  }

  async close(): Promise<void> {
    await this.serverConnector.close();
    this.isListening = false;
  }

  /**
   * Returns a mock server instance that can be used to test the server without starting it
   * It will import the controllers and apply the plugins to the mock server
   */
  async getMockServer(): Promise<MockServer> {
    await this.bootstrap();
    return new MockServer(this);
  }

  private async importControllers(): Promise<void> {
    const controllerPatterns = this.serverOptions.controllerPatterns;
    let controllerPaths = await Promise.all(
      controllerPatterns.map(async (pattern) => {
        return glob(pattern, {
          cwd: nativeCwd.getCwd(),
        });
      }),
    ).then((paths) => paths.flat());

    controllerPaths = controllerPaths.flat();
    controllerPaths = controllerPaths.filter(
      (path) =>
        !this.controllerImportBlacklistedPaths.some((blacklistedPath) =>
          path.includes(blacklistedPath),
        ),
    );

    logger.debug(`Found ${controllerPaths.length} controllers to import`);
    await Promise.all(
      controllerPaths.map(async (controllerPath) => {
        logger.debug(`Importing controller ${controllerPath}`);
        await import(controllerPath).catch((err) => {
          logger.error(`Error importing controller ${controllerPath}: ${err}`);
        });
      }),
    );
  }

  private extractOptionsAndHandlerFromRouteRegistration(
    optionsOrHandler: StandardMethodOptions | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): {
    middlewares: ServerRouteMiddleware[];
    handler: ServerRouteHandler;
    swaggerOptions?: SwaggerRouteOptions;
  } {
    if (typeof optionsOrHandler === "function") {
      // Handler only
      return {
        middlewares: [],
        handler: optionsOrHandler as ServerRouteHandler,
        swaggerOptions: undefined,
      };
    }

    // StandardMethodOptions
    const options = optionsOrHandler as StandardMethodOptions;
    const middlewares = Array.isArray(options.middlewares)
      ? options.middlewares
      : options.middlewares
        ? [options.middlewares]
        : [];

    return {
      middlewares,
      handler: maybeHandler!,
      swaggerOptions: options.swagger,
    };
  }

  private applyPlugins(plugins: ServerPlugin): void {
    Object.entries(plugins).forEach(([pluginName, pluginOptions]) => {
      switch (pluginName as keyof ServerPlugin) {
        case "cors":
          this.use(cors(pluginOptions as CorsOptions));
          break;
        case "json":
          this.use(json(pluginOptions as JsonOptions));
          break;
        case "static":
          this.use(serveStatic(pluginOptions as string));
          break;
        case "fileParser":
          this.use(fileParser(pluginOptions as FilePluginOptions));
          break;
        case "helmet":
          this.use(helmet(pluginOptions as HelmetOptions));
          break;
        case "cookie":
          this.use(cookie(pluginOptions as CookieMiddlewareOptions));
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
        case "urlencoded":
          this.use(urlencoded(pluginOptions as UrlEncodedOptions));
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
        default:
          logger.warn(`Unknown plugin ${pluginName}`);
          break;
      }
    });
  }

  /**
   * Initializes the server by importing the controllers and applying the plugins, it's idempotent, it will not re-import the controllers or apply the plugins if the server was already initialized (e.g. mockServer init)
   * @internal
   */
  private async bootstrap(): Promise<void> {
    if (this.wasInitialized) {
      return;
    }

    await this.importControllers();
    this.applyPlugins(this.serverOptions.plugins);
    this.registerNotFoundRoutes();
    if (this.globalMiddlewares.length) {
      router.applyGlobalMiddlewaresToAllRoutes(this.globalMiddlewares);
    }

    this.wasInitialized = true;
  }

  /**
   * Registers a not found route for all routes that are not defined
   * @internal
   */
  private registerNotFoundRoutes(): void {
    router.addOrUpdate(
      "GET",
      "*",
      [],
      (req, res) => {
        const notFoundError = new RouteNotFoundError(req.url, req.method);
        res.notFound({
          ...errorFactory(notFoundError),
        });
      },
      {
        excludeFromSwagger: true,
      },
    );

    router.addOrUpdate(
      "POST",
      "*",
      [],
      (req, res) => {
        const notFoundError = new RouteNotFoundError(req.url, req.method);
        res.notFound({
          ...errorFactory(notFoundError),
        });
      },
      {
        excludeFromSwagger: true,
      },
    );

    router.addOrUpdate(
      "PUT",
      "*",
      [],
      (req, res) => {
        const notFoundError = new RouteNotFoundError(req.url, req.method);
        res.notFound({
          ...errorFactory(notFoundError),
        });
      },
      {
        excludeFromSwagger: true,
      },
    );

    router.addOrUpdate(
      "PATCH",
      "*",
      [],
      (req, res) => {
        const notFoundError = new RouteNotFoundError(req.url, req.method);
        res.notFound({
          ...errorFactory(notFoundError),
        });
      },
      {
        excludeFromSwagger: true,
      },
    );

    router.addOrUpdate(
      "DELETE",
      "*",
      [],
      (req, res) => {
        const notFoundError = new RouteNotFoundError(req.url, req.method);
        res.notFound({
          ...errorFactory(notFoundError),
        });
      },
      {
        excludeFromSwagger: true,
      },
    );
  }
}
