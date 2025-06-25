import {
  HttpMethod,
  ServerRoute,
  ServerRouteMiddleware,
} from "../native_server/server_types";
import { RouteTree } from "./router_tree";

class Router {
  private routeTree: RouteTree;

  constructor() {
    this.routeTree = new RouteTree();
  }

  getRoutes(): ServerRoute[] {
    return this.routeTree.getAllRoutes();
  }

  addOrUpdateRoute(route: ServerRoute): void {
    this.routeTree.addRoute(route);
  }

  findRoute(
    path: string,
    method: HttpMethod
  ): {
    route: ServerRoute;
    params: Record<string, string>;
  } | null {
    return this.routeTree.findRoute(path, method);
  }

  applyGlobalMiddlewaresToAllRoutes(
    globalMiddlewares: ServerRouteMiddleware[]
  ): void {
    const routes = this.getRoutes();
    for (const route of routes) {
      const allMiddlewares = [
        ...globalMiddlewares,
        ...(route.middlewares || []),
      ];

      const routeWithGlobalMiddlewares = {
        ...route,
        middlewares: allMiddlewares,
      };

      this.addOrUpdateRoute(routeWithGlobalMiddlewares);
    }
  }
}

export const router = new Router();
