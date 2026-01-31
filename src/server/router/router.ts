import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import type {
  HttpMethod,
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types.js";
import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";
import type { Params, Route, RouteResponseSchemas } from "./router_type.js";
import type { ExtractParams } from "./path_types.js";
import {
  compileResponseSchemas,
  compileRequestSchemas,
} from "../../ajv/schema_compiler.js";
import type {
  ControllerHandler,
  ServerHandlerReturnType,
  StandardMethodOptions,
  CacheRouteOptions,
  GetMethodOptions,
} from "../server_types.js";
import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import { wrapHandlerWithValidation } from "./validation_wrapper.js";

class Node {
  staticChildren: Map<string, Node>;
  paramChild: { node: Node; name: string } | null;
  wildcardChild: Node | null;
  middleware: ServerRouteMiddleware[] | null;
  handler: ((req: Request, res: Response) => void) | null;
  paramName: string | null;
  cacheOptions: CacheRouteOptions | null;
  path: string | null;

  constructor() {
    this.staticChildren = new Map();
    this.paramChild = null;
    this.wildcardChild = null;
    this.middleware = null;
    this.handler = null;
    this.paramName = null;
    this.cacheOptions = null;
    this.path = null;
  }
}

type CachedRoute = {
  middleware: ServerRouteMiddleware[];
  handler: ServerRouteHandler;
  params: Params;
  responseSchemas?: RouteResponseSchemas;
  cacheOptions?: CacheRouteOptions;
  path?: string;
};

/**
 * Singleton that handles the routing of requests to the appropriate handler(s).
 */
export class Router {
  private trees: Map<string, Node>;
  private routes: Route[];
  private middlewares: ServerRouteMiddleware[];
  private basePath: string;
  private staticRouteCache: Map<string, CachedRoute>;
  private handlerResponseSchemas: Map<ServerRouteHandler, RouteResponseSchemas>;
  private handlerRoutePath: Map<ServerRouteHandler, string>;

  /**
   * Create a new router with an optional base path and default middlewares.
   * Base path is normalized so it never produces duplicate slashes and never ends with a trailing slash (except root).
   * @param basePath - The base path for all routes in this router
   * @param middlewares - Default middlewares to apply to all routes
   * @param options - Router configuration options
   */
  constructor(
    basePath: string = "",
    middlewares: ServerRouteMiddleware[] = [],
  ) {
    this.trees = new Map();
    this.routes = [];
    this.middlewares = middlewares;
    this.basePath = this.normalizeBasePath(basePath);
    this.staticRouteCache = new Map();
    this.handlerResponseSchemas = new Map();
    this.handlerRoutePath = new Map();
  }

  /** Returns a shallow copy of all registered routes. */
  getRoutes(): Route[] {
    return this.routes.slice();
  }

  /**
   * Add or update a route
   * @internal
   */
  addOrUpdate(
    method: HttpMethod,
    path: string,
    middleware: ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    validationSchemas?: {
      body?: RequestSchema;
      query?: RequestSchema;
      all?: RequestSchema;
    },
    swaggerOptions?: SwaggerRouteOptions,
    cacheOptions?: CacheRouteOptions,
  ): void {
    method = method.toUpperCase() as HttpMethod;
    const clean = path.split("?")[0];

    // Cache options are only allowed on GET routes
    if (cacheOptions && method !== "GET") {
      throw new Error("Cache options are only allowed on GET routes");
    }

    // Pre-compile request schemas (body and query) for faster validation
    compileRequestSchemas(validationSchemas?.body, validationSchemas?.query);

    // Compile and cache response schemas from swagger options
    const responseSchemas = compileResponseSchemas(swaggerOptions?.responses);

    // Wrap handler with validation logic if schemas are provided
    const hasValidation =
      validationSchemas &&
      (validationSchemas.body ||
        validationSchemas.query ||
        validationSchemas.all);
    const finalHandler = hasValidation
      ? wrapHandlerWithValidation(handler, validationSchemas!)
      : handler;

    // Only store validationSchemas if at least one schema is defined
    const finalValidationSchemas = hasValidation
      ? validationSchemas
      : undefined;

    // ensure root exists
    let root = this.trees.get(method);
    if (!root) {
      root = new Node();
      this.trees.set(method, root);
    }

    const trimmed = clean.replace(/^\/+|\/+$/g, "");
    const segments = trimmed.length === 0 ? [] : trimmed.split("/");

    let isStaticRoute = true;
    const paramNames: string[] = [];

    let node = root;
    for (const seg of segments) {
      if (seg === "*") {
        isStaticRoute = false;
        if (!node.wildcardChild) {
          node.wildcardChild = new Node();
        }
        node = node.wildcardChild;
        break;
      }

      if (seg.startsWith(":")) {
        isStaticRoute = false;
        const name = seg.slice(1);
        paramNames.push(name);
        if (!node.paramChild) {
          node.paramChild = { node: new Node(), name };
        }
        node = node.paramChild.node;
        continue;
      }

      // static segment
      if (!node.staticChildren.has(seg)) {
        node.staticChildren.set(seg, new Node());
      }
      node = node.staticChildren.get(seg)!;
    }

    // assign middleware & handler (use wrapped handler if validation is enabled)
    node.middleware = middleware;
    node.handler = finalHandler;

    if (paramNames.length > 0) {
      node.paramName = paramNames.join(",");
    }

    // Store path pattern (the path parameter contains the pattern, e.g. /users/:id)
    node.path = path;

    // Store cache options on node
    if (cacheOptions) {
      node.cacheOptions = cacheOptions;
    }

    // Store response schemas in O(1) lookup map for dynamic routes
    // Use the original handler as key (before wrapping) for consistency
    if (responseSchemas) {
      this.handlerResponseSchemas.set(handler, responseSchemas);
    }

    // Store path pattern in O(1) lookup map for dynamic routes
    this.handlerRoutePath.set(handler, path);

    if (isStaticRoute) {
      const normalizedPath = "/" + trimmed;
      const cacheKey = `${method}:${normalizedPath}`;
      this.staticRouteCache.set(cacheKey, {
        middleware,
        handler: finalHandler,
        params: {},
        responseSchemas,
        cacheOptions,
        path,
      });
    } else {
      // If updating a route that was previously static, clear old cache entry
      const normalizedPath =
        "/" + trimmed.replace(/:[^/]+/g, "").replace(/\/+/g, "/");
      const cacheKey = `${method}:${normalizedPath}`;
      this.staticRouteCache.delete(cacheKey);
    }

    // upsert in registry
    const idx = this.routes.findIndex(
      (r) => r.method === method && r.path === path,
    );
    if (idx !== -1) {
      this.routes[idx].middleware = middleware;
      this.routes[idx].handler = finalHandler;
      this.routes[idx].swaggerOptions = swaggerOptions;
      this.routes[idx].responseSchemas = responseSchemas;
      this.routes[idx].validationSchemas = finalValidationSchemas;
      this.routes[idx].cacheOptions = cacheOptions;
      return;
    }

    this.routes.push({
      method,
      path,
      middleware,
      handler: finalHandler,
      swaggerOptions,
      responseSchemas,
      validationSchemas: finalValidationSchemas,
      cacheOptions,
    });
  }

  /**
   * Find the matching route for the given HTTP method and path.
   * Returns the resolved middleware chain, handler, extracted params, response schemas, cache options, and path pattern; or null if not found.
   * Uses O(1) cache lookup for static routes, falls back to O(k) tree traversal for dynamic routes.
   */
  find(
    method: string,
    rawPath: string,
  ): {
    middleware: ServerRouteMiddleware[];
    handler: ServerRouteHandler;
    params: Params;
    responseSchemas?: RouteResponseSchemas;
    cacheOptions?: CacheRouteOptions;
    path?: string;
  } | null {
    method = method.toUpperCase();

    // O(1) lookup for static routes
    let pathWithoutQuery = rawPath;
    const queryIndex = rawPath.indexOf("?");
    if (queryIndex !== -1) {
      pathWithoutQuery = rawPath.substring(0, queryIndex);
    }
    const cacheKey = `${method}:${pathWithoutQuery}`;
    const cachedRoute = this.staticRouteCache.get(cacheKey);
    if (cachedRoute) {
      return cachedRoute;
    }

    // fall back to O(k) tree traversal for dynamic routes
    const root = this.trees.get(method);
    if (!root) {
      return null;
    }

    const trimmed = pathWithoutQuery.replace(/^\/+|\/+$/g, "");
    const segments = trimmed.length === 0 ? [] : trimmed.split("/");
    const params: Params = {};

    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      if (node.staticChildren.has(seg)) {
        node = node.staticChildren.get(seg)!;
        continue;
      }

      if (node.paramChild) {
        params[node.paramChild.name] = seg;
        node = node.paramChild.node;
        continue;
      }

      if (node.wildcardChild) {
        params["*"] = segments.slice(i).join("/");
        node = node.wildcardChild;
        break;
      }

      return null;
    }

    if (!node.handler || !node.middleware) {
      return null;
    }

    // O(1) lookup for response schemas using handler map
    const responseSchemas = this.handlerResponseSchemas.get(node.handler);

    // O(1) lookup for path pattern using handler map
    const routePath = this.handlerRoutePath.get(node.handler);

    return {
      middleware: node.middleware,
      handler: node.handler,
      params,
      responseSchemas,
      cacheOptions: node.cacheOptions ?? undefined,
      path: routePath ?? node.path ?? undefined,
    };
  }

  /**
   * Private helper method to register a route with the given HTTP method.
   * Handles middleware detection, path joining, and swagger options merging.
   * @internal
   */
  private extractOptionsAndHandler(
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
      return {
        middlewares: [],
        handler: optionsOrHandler as ServerRouteHandler,
        swaggerOptions: undefined,
      };
    }

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

  /**
   * Register a GET route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions, cache } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "GET",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
      cache,
    );
  }

  /**
   * Register a POST route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "POST",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Register a PATCH route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "PATCH",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Register a PUT route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "PUT",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Register a DELETE route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "DELETE",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Register an OPTIONS route under this router's base path with type-safe path parameters.
   */
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
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "OPTIONS",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Register an HEAD route under this router's base path with type-safe path parameters.
   */
  head<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
      ...args: any[]
    ) => ServerHandlerReturnType,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    options: StandardMethodOptions,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
      ...args: any[]
    ) => ServerHandlerReturnType,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    optionsOrHandler:
      | StandardMethodOptions
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
          ...args: any[]
        ) => ServerHandlerReturnType),
    maybeHandler?: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
      ...args: any[]
    ) => ServerHandlerReturnType,
  ): void {
    const fullPath = this.joinPath(path);
    const { middlewares, handler, body, query, all, swaggerOptions } =
      this.extractOptionsAndHandler(optionsOrHandler, maybeHandler);

    const combined = [...this.middlewares, ...middlewares];
    const validationSchemas = { body, query, all };

    this.addOrUpdate(
      "HEAD",
      fullPath,
      combined,
      handler,
      validationSchemas,
      swaggerOptions,
    );
  }

  /**
   * Create a grouped router that shares a base path and middlewares.
   * The callback receives a child router where routes are defined; routes
   * are then merged back into the parent with the composed base path and middlewares.
   */
  group(
    path: string,
    middleware: ServerRouteMiddleware[] | ServerRouteMiddleware,
    cb: (router: Router) => void,
  ): void;
  group(path: string, cb: (router: Router) => void): void;
  group(
    path: string,
    middlewareOrCb:
      | ServerRouteMiddleware[]
      | ServerRouteMiddleware
      | ((router: Router) => void),
    maybeCb?: (router: Router) => void,
  ): void {
    const groupMiddlewares = Array.isArray(middlewareOrCb)
      ? middlewareOrCb
      : typeof middlewareOrCb === "function"
        ? []
        : middlewareOrCb
          ? [middlewareOrCb]
          : [];
    const cb = (
      Array.isArray(middlewareOrCb)
        ? maybeCb
        : typeof middlewareOrCb === "function"
          ? (middlewareOrCb as (router: Router) => void)
          : undefined
    ) as ((router: Router) => void) | undefined;

    const childBase = this.joinPath(path);
    const child = new Router(childBase, [
      ...this.middlewares,
      ...groupMiddlewares,
    ]);
    cb?.(child);
    for (const r of child.getRoutes()) {
      this.addOrUpdate(
        r.method as HttpMethod,
        r.path,
        r.middleware,
        r.handler,
        r.validationSchemas,
        r.swaggerOptions,
        r.cacheOptions,
      );
    }
  }

  /**
   * Apply global middlewares to all routes
   * @param middlewares - The middlewares to apply
   * @internal
   */
  applyGlobalMiddlewaresToAllRoutes(
    middlewares: ServerRouteMiddleware[],
  ): void {
    for (const route of this.routes) {
      const updatedMiddleware = [...middlewares, ...(route.middleware || [])];
      this.addOrUpdate(
        route.method as HttpMethod,
        route.path,
        updatedMiddleware,
        route.handler,
      );
    }
  }

  private normalizeBasePath(path: string): string {
    if (!path) {
      return "";
    }

    let normalized = path.replace(/\s+/g, "");
    normalized = normalized.replace(/\/+/g, "/");
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }

    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/g, "");
    }

    return normalized;
  }

  private joinPath(path: string): string {
    const parts = [this.basePath, path].filter(
      (v) => typeof v === "string" && v.length > 0,
    ) as string[];
    let joined = parts.join("/");
    joined = joined.replace(/\/+/g, "/");
    if (!joined.startsWith("/")) {
      joined = "/" + joined;
    }
    if (joined.length > 1) {
      joined = joined.replace(/\/+$/g, "");
    }
    return joined;
  }

  /**
   * Clears all registered routes (useful for testing or hot reload scenarios)
   * @internal
   */
  clearRoutes(): void {
    this.routes = [];
    this.staticRouteCache.clear();
    this.handlerResponseSchemas.clear();
    this.handlerRoutePath.clear();
    this.trees.clear();
  }
}

/** Main singleton router instance */
export const router = new Router();
