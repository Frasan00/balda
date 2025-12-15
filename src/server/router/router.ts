import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import {
  HttpMethod,
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types.js";
import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";
import type { Params, Route } from "./router_type.js";

class Node {
  staticChildren: Map<string, Node>;
  paramChild: { node: Node; name: string } | null;
  wildcardChild: Node | null;
  middleware: ServerRouteMiddleware[] | null;
  handler: ((req: Request, res: Response) => void) | null;

  constructor() {
    this.staticChildren = new Map();
    this.paramChild = null;
    this.wildcardChild = null;
    this.middleware = null;
    this.handler = null;
  }
}

/**
 * Singleton that handles the routing of requests to the appropriate handler(s).
 */
export class Router {
  private trees: Map<string, Node>;
  private routes: Route[];
  private middlewares: ServerRouteMiddleware[];
  private basePath: string;

  /**
   * Create a new router with an optional base path and default middlewares.
   * Base path is normalized so it never produces duplicate slashes and never ends with a trailing slash (except root).
   */
  constructor(
    basePath: string = "",
    middlewares: ServerRouteMiddleware[] = [],
  ) {
    this.trees = new Map();
    this.routes = [];
    this.middlewares = middlewares;
    this.basePath = this.normalizeBasePath(basePath);
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

    // ensure root exists
    let root = this.trees.get(method);
    if (!root) {
      root = new Node();
      this.trees.set(method, root);
    }

    // strip query string and split into segments (handling root path correctly)
    const clean = path.split("?")[0];
    const trimmed = clean.replace(/^\/+|\/+$/g, "");
    const segments = trimmed.length === 0 ? [] : trimmed.split("/");

    let node = root;
    for (const seg of segments) {
      if (seg === "*") {
        if (!node.wildcardChild) {
          node.wildcardChild = new Node();
        }
        node = node.wildcardChild;
        break;
      }

      if (seg.startsWith(":")) {
        const name = seg.slice(1);
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

    // upsert in registry
    const idx = this.routes.findIndex(
      (r) => r.method === method && r.path === path,
    );
    if (idx !== -1) {
      this.routes[idx].middleware = middleware;
      this.routes[idx].handler = handler;
      return;
    }

    this.routes.push({ method, path, middleware, handler, swaggerOptions });
  }

  /**
   * Find the matching route for the given HTTP method and path.
   * Returns the resolved middleware chain, handler, and extracted params; or null if not found.
   */
  find(
    method: string,
    rawPath: string,
  ): {
    middleware: ServerRouteMiddleware[];
    handler: ServerRouteHandler;
    params: Params;
  } | null {
    method = method.toUpperCase();
    const root = this.trees.get(method);
    if (!root) {
      return null;
    }

    const clean = rawPath.split("?")[0];
    const trimmed = clean.replace(/^\/+|\/+$/g, "");
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

    return { middleware: node.middleware, handler: node.handler, params };
  }

  /**
   * Register a GET route under this router's base path.
   */
  get(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  get(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  get(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("GET", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register a POST route under this router's base path.
   */
  post(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  post(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  post(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("POST", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register a PATCH route under this router's base path.
   */
  patch(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  patch(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  patch(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("PATCH", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register a PUT route under this router's base path.
   */
  put(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  put(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  put(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("PUT", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register a DELETE route under this router's base path.
   */
  delete(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  delete(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  delete(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("DELETE", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register an OPTIONS route under this router's base path.
   */
  options(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  options(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  options(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("OPTIONS", fullPath, middlewares, handler, swaggerOptions);
  }

  /**
   * Register an HEAD route under this router's base path.
   */
  head(
    path: string,
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  head(
    path: string,
    middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
    handler: ServerRouteHandler,
    swaggerOptions?: SwaggerRouteOptions,
  ): void;
  head(
    path: string,
    middlewareOrHandler:
      | ServerRouteMiddleware
      | ServerRouteMiddleware[]
      | ServerRouteHandler,
    maybeHandler?: ServerRouteHandler | SwaggerRouteOptions,
    maybeSwagger?: SwaggerRouteOptions,
  ): void {
    const fullPath = this.joinPath(path);
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
    this.addOrUpdate("HEAD", fullPath, middlewares, handler, swaggerOptions);
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
      this.addOrUpdate(
        route.method as HttpMethod,
        route.path,
        [...middlewares, ...(route.middleware || [])],
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
}

/** Main singleton router instance */
export const router = new Router();
