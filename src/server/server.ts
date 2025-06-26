import { glob } from "glob";
import { type Logger } from "pino";
import { createLogger } from "src/logger/logger";
import { bodyParser } from "src/plugins/body_parser/body_parser";
import { cors } from "../plugins/cors/cors";
import type { CorsOptions } from "../plugins/cors/cors_types";
import { json } from "../plugins/json/json";
import type { JsonOptions } from "../plugins/json/json_options";
import { ServerConnector } from "../runtime/native_server/server_connector";
import type {
  RuntimeServerMap,
  ServerListenCallback,
  ServerRouteHandler,
  ServerRouteMiddleware,
  ServerTapOptions,
} from "../runtime/native_server/server_types";
import type { RunTimeType } from "../runtime/runtime";
import { router } from "./router/router";
import { PROTECTED_KEYS } from "./server_constants";
import type {
  ServerErrorHandler,
  ServerInterface,
  ServerOptions,
  ServerPlugin,
} from "./server_types";

/**
 * The server class that is used to create and manage the server
 */
export class Server implements ServerInterface {
  controllerImportBlacklistedPaths: string[] = [
    "node_modules",
    "dist",
    ".config",
  ];
  isListening: boolean;
  logger: Logger;
  declare private serverConnector: ServerConnector;
  private globalMiddlewares: ServerRouteMiddleware[] = [];
  declare private options: Required<ServerOptions>;
  get url(): string {
    return this.serverConnector.url;
  }

  get port(): number {
    return this.serverConnector.port;
  }

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

    this.use(bodyParser());
    this.applyPlugins(this.options.plugins);
    this.isListening = false;
  }

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

    router.addOrUpdate("GET", path, middlewares, handler);
  }

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

    router.addOrUpdate("POST", path, middlewares, handler);
  }

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

    router.addOrUpdate("PATCH", path, middlewares, handler);
  }

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

    router.addOrUpdate("PUT", path, middlewares, handler);
  }

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

    router.addOrUpdate("DELETE", path, middlewares, handler);
  }

  /**
   * Get the server for the given runtime, you can specify the runtime to get the server for for better type safety, if not specified it will default to "node"
   * @example getServer("node") returns HttpServer
   * @example getServer("bun") returns ReturnType<typeof Bun.serve>
   * @example getServer("deno") returns ReturnType<typeof Deno.serve>
   * @param runtime - The runtime to get the server for
   * @returns The server for the given runtime
   */
  getRuntimeServer<T extends RunTimeType>(runtime?: T): RuntimeServerMap<T> {
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
  use(middleware: ServerRouteMiddleware): void {
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

  tap?: <T extends RunTimeType>(
    runtime?: T,
    options?: ServerTapOptions<T>,
  ) => RuntimeServerMap<T>;

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
          this.use(cors(pluginOptions as CorsOptions));
          break;
        case "json":
          this.use(json(pluginOptions as JsonOptions));
          break;
      }
    });
  }
}
