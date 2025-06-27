import type { Params, Route } from "./router_type";
import {
  HttpMethod,
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types";
import type { Request } from "../http/request";
import type { Response } from "../http/response";
import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";

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

  constructor() {
    this.trees = new Map();
    this.routes = [];
  }

  getRoutes(): Route[] {
    return this.routes.slice();
  }

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

    // strip query string and split into segments
    const clean = path.split("?")[0];
    const segments = clean.replace(/^\/+|\/+$/g, "").split("/");

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
    const segments = clean.replace(/^\/+|\/+$/g, "").split("/");
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
}

export const router = new Router();
