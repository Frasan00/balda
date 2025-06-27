import { glob } from "glob";
import { type Logger } from "pino";
import { createLogger } from "../logger/logger";
import { bodyParser } from "../plugins/body_parser/body_parser";
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
import { RunTime } from "../runtime/runtime";
import { router } from "./router/router";
import { PROTECTED_KEYS } from "./server_constants";
import type {
  ServerErrorHandler,
  ServerInterface,
  ServerOptions,
  ServerPlugin,
} from "./server_types";
import { nativeCwd } from "../runtime/native_cwd";
import { serveStatic } from "../plugins/static/static";
import { fileParser } from "../plugins/file/file";
import type { FilePluginOptions } from "../plugins/file/file_types";
import { join } from "node:path";
import { helmet } from "../plugins/helmet/helmet";
import type { HelmetOptions } from "../plugins/helmet/helmet_types";

/**
 * The server class that is used to create and manage the server
 */
export class Server implements ServerInterface {
  isListening: boolean;
  logger: Logger;
  tapOptions?: ServerTapOptions;
  runtime: RunTime;

  private serverConnector: ServerConnector;
  private globalMiddlewares: ServerRouteMiddleware[] = [];
  private options: Required<ServerOptions>;
  private controllerImportBlacklistedPaths: string[] = [
    "node_modules",
    "dist",
    ".config",
  ];

  /**
   * The constructor for the server
   * @warning Routes will only be defined after calling the `listen` method so you're free to define middlewares before calling it
   * @param options - The options for the server
   * @param options.port - The port to listen on, defaults to 80
   * @param options.host - The hostname to listen on, defaults to 0.0.0.0
   * @param options.controllerPatterns - The patterns to match for controllers, defaults to every .ts and .js file in the root directory
   * @param options.plugins - The plugins to apply to the server, by default no plugins are applied, plugins are applied in the order they are defined in the options
   * @param options.logger - The logger to use for the server, by default a default logger is used
   * @param options.tapOptions - Options fetch to the runtime server before the server is up and running
   */
  constructor(options?: ServerOptions) {
    this.options = {
      port: options?.port ?? 80,
      host: options?.host ?? "0.0.0.0",
      controllerPatterns: options?.controllerPatterns ?? ["**/*.{ts,js}"],
      plugins: options?.plugins ?? {},
      logger: options?.logger ?? {},
      tapOptions: options?.tapOptions ?? ({} as ServerTapOptions),
    };

    this.runtime = new RunTime();

    this.serverConnector = new ServerConnector({
      routes: [],
      port: this.options.port,
      host: this.options.host,
      tapOptions: this.options.tapOptions,
      runtime: this.runtime.type,
    });

    this.logger = createLogger(this.options.logger);

    this.use(bodyParser());
    this.applyPlugins(this.options.plugins);

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

  tmpDir(append?: string): string {
    const baseTmpDir = "tmp";
    if (append) {
      return join(baseTmpDir, append);
    }

    return join(nativeCwd.getCwd(), baseTmpDir);
  }

  get(path: string, handler: ServerRouteHandler): void;
  get(
    path: string,
    middlewares: ServerRouteMiddleware[],
    handler: ServerRouteHandler
  ): void;
  get(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler
      );

    router.addOrUpdate("GET", path, middlewares, handler);
  }

  post(path: string, handler: ServerRouteHandler): void;
  post(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void;
  post(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler
      );

    router.addOrUpdate("POST", path, middlewares, handler);
  }

  patch(path: string, handler: ServerRouteHandler): void;
  patch(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler
      );

    router.addOrUpdate("PATCH", path, middlewares, handler);
  }

  put(path: string, handler: ServerRouteHandler): void;
  put(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void;
  put(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler
      );

    router.addOrUpdate("PUT", path, middlewares, handler);
  }

  delete(path: string, handler: ServerRouteHandler): void;
  delete(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void;
  delete(
    path: string,
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
  ): void {
    const { middlewares, handler } =
      this.extractMiddlewaresAndHandlerFromRouteRegistration(
        middlewaresOrHandler,
        maybeHandler
      );

    router.addOrUpdate("DELETE", path, middlewares, handler);
  }

  getNodeServer(): RuntimeServerMap<"node"> {
    // TODO: BaldaError implementation
    if (this.runtime.type !== "node") {
      throw new Error(
        "Server is not using node runtime, you can't call `.getNodeServer()`"
      );
    }

    return this.serverConnector.getServer("node");
  }

  embed(key: string, value: any): void {
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(
        `Invalid key provided to embed: ${key}. Key must be a non-empty string.`
      );
    }

    if (PROTECTED_KEYS.includes(key)) {
      throw new Error(
        `Cannot embed value with key '${key}' as it conflicts with a protected server property.`
      );
    }

    Object.defineProperty(this, key, {
      value,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }

  use(middleware: ServerRouteMiddleware): void {
    this.globalMiddlewares.push(middleware);
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

  listen(cb?: ServerListenCallback): void {
    if (this.isListening) {
      throw new Error(
        "Server is already listening, you can't call `.listen()` multiple times"
      );
    }

    this.importControllers()
      .then(() => {
        if (this.globalMiddlewares.length) {
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
      });
  }

  async close(): Promise<void> {
    await this.serverConnector.close();
    this.isListening = false;
  }

  private async importControllers(): Promise<void> {
    const controllerPatterns = this.options.controllerPatterns;
    let controllerPaths = await glob(controllerPatterns.join(","), {
      cwd: nativeCwd.getCwd(),
    });

    controllerPaths = controllerPaths.filter(
      (path) =>
        !this.controllerImportBlacklistedPaths.some((blacklistedPath) =>
          path.includes(blacklistedPath)
        )
    );

    await Promise.all(
      controllerPaths.map(async (controllerPath) => {
        this.logger.debug(`Importing controller ${controllerPath}`);
        await import(controllerPath).catch((err) => {
          this.logger.error(
            `Error importing controller ${controllerPath}: ${err}`
          );
        });
      })
    );
  }

  private extractMiddlewaresAndHandlerFromRouteRegistration(
    middlewaresOrHandler: ServerRouteMiddleware[] | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler
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
        case "static":
          this.use(serveStatic(pluginOptions as string));
          break;
        case "fileParser":
          this.use(fileParser(pluginOptions as FilePluginOptions));
          break;
        case "helmet":
          this.use(helmet(pluginOptions as HelmetOptions));
          break;
        default:
          this.logger.warn(`Unknown plugin ${pluginName}`);
          break;
      }
    });
  }
}
