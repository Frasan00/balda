import { glob } from "glob";
import { PROTECTED_KEYS } from "./server_constants";
import { ServerConnector } from "../runtime/native_server/server_connector";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../runtime/native_server/server_types";
import { router } from "../runtime/router/router";
import type { RunTimeType } from "../runtime/runtime";
import type {
  ServerErrorHandler,
  ServerInterface,
  ServerOptions,
  ServerPlugin,
} from "./server_types";
import { cors } from "../plugins/cors/cors";
import { json } from "../plugins/json/json";
import type { CorsOptions } from "../plugins/cors/cors_types";
import type { JsonOptions } from "../plugins/json/json_options";
import { bodyParser } from "src/plugins/body_parser/body_parser";
import { type Logger } from "pino";
import { createLogger } from "src/logger/logger";

/**
 * The server class that is used to create and manage the server
 */
export class Server implements ServerInterface {
  /**
   * Whether the server is listening for requests
   */
  isListening: boolean;

  /**
   * The logger for the server
   */
  logger: Logger;

  /**
   * The paths that are blacklisted from being imported as controllers
   */
  controllerImportBlacklistedPaths: string[] = [
    "node_modules",
    "dist",
    ".config",
  ];

  /**
   * The server connector for the current runtime
   */
  declare private serverConnector: ServerConnector;

  /**
   * The middlewares to be applied to all routes after the listener is bound
   */
  private globalMiddlewares: ServerRouteMiddleware[] = [];

  /**
   * The options for the server
   */
  declare private options: Required<ServerOptions>;

  /**
   * The url of the server
   */
  get url(): string {
    return this.serverConnector.url;
  }

  /**
   * The port of the server
   */
  get port(): number {
    return this.serverConnector.port;
  }

  /**
   * The host of the server
   */
  get host(): string {
    return this.serverConnector.host;
  }

  /**
   * The constructor for the server
   * @warning Routes will only be defined after calling the `listen` method so you're free to define middlewares before calling it
   * @param options - The options for the server
   * @param options.port - The port to listen on, defaults to 80
   * @param options.host - The hostname to listen on, defaults to 0.0.0.0
   * @param options.controllerPatterns - The patterns to match for controllers, defaults to every .ts and .js file in the root directory
   * @param options.plugins - The plugins to apply to the server, by default no plugins are applied, plugins are applied in the order they are defined in the options
   */
  constructor(options?: ServerOptions) {
    this.options = {
      port: options?.port ?? 80,
      host: options?.host ?? "0.0.0.0",
      controllerPatterns: options?.controllerPatterns ?? ["**/*.{ts,js}"],
      plugins: options?.plugins ?? {},
      logger: options?.logger ?? {},
    };

    this.serverConnector = new ServerConnector({
      routes: [],
      port: this.options.port,
      host: this.options.host,
    });

    this.logger = createLogger(this.options.logger);

    this.useGlobalMiddleware(bodyParser());
    this.applyPlugins(this.options.plugins);

    this.isListening = false;
  }

  /**
   * Register a GET route for the server, useful for simple routes, use decorators for more complex scenarios
   */
  get(path: string, handler: ServerRouteHandler): void;
  get(
    path: string,
    middlewares: ServerRouteMiddleware[],
    handler: ServerRouteHandler,
  ): void;
  get(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler,
      );

    router.addOrUpdateRoute({
      path,
      method: "GET",
      middlewares,
      handler,
    });
  }

  /**
   * Register a POST route for the server, useful for simple routes, use decorators for more complex scenarios
   */
  post(path: string, handler: ServerRouteHandler): void;
  post(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void;
  post(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler,
      );

    router.addOrUpdateRoute({
      path,
      method: "POST",
      middlewares,
      handler,
    });
  }

  /**
   * Register a PATCH route for the server, useful for simple routes, use decorators for more complex scenarios
   */
  patch(path: string, handler: ServerRouteHandler): void;
  patch(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler,
      );

    router.addOrUpdateRoute({
      path,
      method: "PATCH",
      middlewares,
      handler,
    });
  }

  /**
   * Register a PUT route for the server, useful for simple routes, use decorators for more complex scenarios
   */
  put(path: string, handler: ServerRouteHandler): void;
  put(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void;
  put(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler,
      );

    router.addOrUpdateRoute({
      path,
      method: "PUT",
      middlewares,
      handler,
    });
  }

  /**
   * Register a DELETE route for the server, useful for simple routes, use decorators for more complex scenarios
   */
  delete(path: string, handler: ServerRouteHandler): void;
  delete(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void;
  delete(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler,
      );

    router.addOrUpdateRoute({
      path,
      method: "DELETE",
      middlewares,
      handler,
    });
  }

  /**
   * Get the server for the given runtime, you can specify the runtime to get the server for for better type safety, if not specified it will default to "node"
   * @example getServer("node") returns HttpServer
   * @example getServer("bun") returns ReturnType<typeof Bun.serve>
   * @example getServer("deno") returns ReturnType<typeof Deno.serve>
   * @param runtime - The runtime to get the server for
   * @returns The server for the given runtime
   */
  getServer<T extends RunTimeType>(runtime?: T): RuntimeServerMap<T> {
    return this.serverConnector.getServer(runtime ?? ("node" as T));
  }

  /**
   * Embed the given key into the server instance, this is useful for embedding the server with custom properties, you can extend the server with your own properties to type it
   * @param key - The key to embed
   * @param value - The value to embed
   * @warning This method is not type safe, so you need to be careful when using it, already defined properties will be overridden
   * @warning There are some keys that are protected and cannot be embedded, you can find the list of protected keys in the PROTECTED_KEYS constant
   * @throws An error if the key is protected
   */
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

  /**
   * Add a global middleware to the router that will be applied to all routes. Will be applied in the order they are added.
   */
  useGlobalMiddleware(middleware: ServerRouteMiddleware): void {
    this.globalMiddlewares.push(middleware);
  }

  /**
   * Set the error handler for the server
   * @param errorHandler - The error handler to be applied to all routes
   */
  setErrorHandler(errorHandler?: ServerErrorHandler): void {
    this.globalMiddlewares.unshift(async (req, res, next) => {
      try {
        await next();
      } catch (error) {
        await errorHandler?.(req, res, next, error as Error);
      }
    });
  }

  /**
   * Binds the server to the port and hostname defined in the serverOptions, meant to be called only once
   * This method will also register the routes defined in the controllers
   */
  async listen(cb?: ServerListenCallback): Promise<void> {
    if (this.isListening) {
      throw new Error(
        "Server is already listening, you can't call `.listen()` multiple times",
      );
    }

    await this.importControllers();
    router.loadRoutes();
    if (this.globalMiddlewares.length > 0) {
      router.applyGlobalMiddlewaresToAllRoutes(this.globalMiddlewares);
    }

    this.serverConnector.listen();
    this.isListening = true;
    cb?.({
      port: this.port,
      host: this.host,
      url: this.url,
      logger: this.logger,
    });
  }

  /**
   * Closes the server and frees the port
   */
  async close(): Promise<void> {
    await this.serverConnector.close();
    this.isListening = false;
  }

  private async importControllers(): Promise<void> {
    const controllerPatterns = this.options.controllerPatterns;
    let controllerPaths = await glob(controllerPatterns.join(","), {
      cwd: process.cwd(),
    });

    controllerPaths = controllerPaths.filter(
      (path) =>
        !this.controllerImportBlacklistedPaths.some((blacklistedPath) =>
          path.includes(blacklistedPath),
        ),
    );

    await Promise.all(
      controllerPaths.map(async (controllerPath) => {
        await import(controllerPath).catch((err) => {
          this.logger.error(
            `Error importing controller ${controllerPath}: ${err}`,
          );
        });
      }),
    );
  }

  private extractMiddlewaresAndHandlerFromRouteRegistration(
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler,
  ): { middlewares: ServerRouteMiddleware[]; handler: ServerRouteHandler } {
    const middlewares =
      typeof middlewaresOrHandler === "function" ? [] : middlewaresOrHandler;

    const handler =
      typeof middlewaresOrHandler === "function"
        ? middlewaresOrHandler
        : maybeHandler!;

    return { middlewares, handler };
  }

  private applyPlugins(plugins: ServerPlugin): void {
    Object.entries(plugins).forEach(([pluginName, pluginOptions]) => {
      switch (pluginName as keyof ServerPlugin) {
        case "cors":
          this.useGlobalMiddleware(cors(pluginOptions as CorsOptions));
          break;
        case "json":
          this.useGlobalMiddleware(json(pluginOptions as JsonOptions));
          break;
      }
    });
  }
}
