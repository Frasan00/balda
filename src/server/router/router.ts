import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import {
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

class Node {
  staticChildren: Map<string, Node>;
  paramChild: { node: Node; name: string } | null;
  wildcardChild: Node | null;
  middleware: ServerRouteMiddleware[] | null;
  handler: ((req: Request, res: Response) => void) | null;
  paramName: string | null;

  constructor() {
    this.staticChildren = new Map();
    this.paramChild = null;
    this.wildcardChild = null;
    this.middleware = null;
    this.handler = null;
    this.paramName = null;
  }
}

type CachedRoute = {
  middleware: ServerRouteMiddleware[];
  handler: ServerRouteHandler;
  params: Params;
  responseSchemas?: RouteResponseSchemas;
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
    swaggerOptions?: SwaggerRouteOptions,
  ): void {
    method = method.toUpperCase() as HttpMethod;
    const clean = path.split("?")[0];

    // Pre-compile request schemas (body and query) for faster validation
    compileRequestSchemas(swaggerOptions?.requestBody, swaggerOptions?.query);

    // Compile and cache response schemas from swagger options
    const responseSchemas = compileResponseSchemas(swaggerOptions?.responses);

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

    // assign middleware & handler
    node.middleware = middleware;
    node.handler = handler;

    if (paramNames.length > 0) {
      node.paramName = paramNames.join(",");
    }

    if (isStaticRoute) {
      const normalizedPath = "/" + trimmed;
      const cacheKey = `${method}:${normalizedPath}`;
      this.staticRouteCache.set(cacheKey, {
        middleware,
        handler,
        params: {},
        responseSchemas,
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
      this.routes[idx].handler = handler;
      this.routes[idx].swaggerOptions = swaggerOptions;
      this.routes[idx].responseSchemas = responseSchemas;
      return;
    }

    this.routes.push({
      method,
      path,
      middleware,
      handler,
      swaggerOptions,
      responseSchemas,
    });
  }

  /**
   * Find the matching route for the given HTTP method and path.
   * Returns the resolved middleware chain, handler, extracted params, and response schemas; or null if not found.
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

    // Look up response schemas from routes array for dynamic routes
    const route = this.routes.find(
      (r) => r.method === method && r.handler === node.handler,
    );

    return {
      middleware: node.middleware,
      handler: node.handler,
      params,
      responseSchemas: route?.responseSchemas,
    };
  }

  /**
   * Private helper method to register a route with the given HTTP method.
   * Handles middleware detection, path joining, and swagger options merging.
   * @internal
   */
  private registerRoute<TPath extends string>(
    method: HttpMethod,
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);

    // Use arity check: middleware has 3 params (req, res, next), handler has 2 (req, res)
    const isHandlerOnly =
      typeof middlewareOrHandler === "function" &&
      (middlewareOrHandler as Function).length !== 3;

    const handler = (
      isHandlerOnly
        ? (middlewareOrHandler as ServerRouteHandler)
        : (maybeHandler as ServerRouteHandler)
    ) as ServerRouteHandler;

    const provided = isHandlerOnly
      ? []
      : Array.isArray(middlewareOrHandler)
        ? middlewareOrHandler
        : [middlewareOrHandler as ServerRouteMiddleware];

    const middlewares = [...this.middlewares, ...provided];

    const swaggerOptions = (
      isHandlerOnly ? (maybeHandler as SwaggerRouteOptions) : maybeSwagger
    ) as SwaggerRouteOptions | undefined;

    this.addOrUpdate(method, fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register a GET route under this router's base path with type-safe path parameters.
   */
  get<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  get<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  get<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "GET",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
    );
  }

  /**
   * Register a POST route under this router's base path with type-safe path parameters.
   */
  post<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  post<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  post<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "POST",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
    );
  }

  /**
   * Register a PATCH route under this router's base path with type-safe path parameters.
   */
  patch<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  patch<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  patch<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "PATCH",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
    );
  }

  /**
   * Register a PUT route under this router's base path with type-safe path parameters.
   */
  put<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  put<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  put<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "PUT",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
    );
  }

  /**
   * Register a DELETE route under this router's base path with type-safe path parameters.
   */
  delete<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  delete<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  delete<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "DELETE",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
    );
  }

  /**
   * Register an OPTIONS route under this router's base path with type-safe path parameters.
   */
  options<TPath extends string = string>(
    path: TPath,
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  options<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  options<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "OPTIONS",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
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
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: (
      req: Request<ExtractParams<TPath>>,
      res: Response,
    ) => void | Promise<void>,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  head<TPath extends string = string>(
    path: TPath,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>),
    maybeHandler?:
      | ((
          req: Request<ExtractParams<TPath>>,
          res: Response,
        ) => void | Promise<void>)
      | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    this.registerRoute(
      "HEAD",
      path,
      middlewareOrHandler,
      maybeHandler,
      maybeSwagger,
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
        r.swaggerOptions,
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
    this.trees.clear();
  }
}

/** Main singleton router instance */
export const router = new Router();
