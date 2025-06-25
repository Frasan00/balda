import { MetadataStore } from "../../metadata_store";
import type {
  HttpMethod,
  ServerRoute,
  ServerRouteMiddleware,
} from "../server/server_types";

interface RouteNode {
  path: string;
  isParam: boolean;
  paramName?: string;
  methods: Map<HttpMethod, ServerRoute>;
  children: Map<string, RouteNode>;
  wildcard?: ServerRoute;
  middlewares?: ServerRouteMiddleware[];
}

export class RouteTree {
  private root: RouteNode;

  constructor() {
    this.root = {
      path: "",
      isParam: false,
      methods: new Map(),
      children: new Map(),
    };
  }

  addRoute(route: ServerRoute): void {
    const segments = this.parsePath(route.path);
    let currentNode = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        const paramKey = `:${paramName}`;

        if (!currentNode.children.has(paramKey)) {
          currentNode.children.set(paramKey, {
            path: segment,
            isParam: true,
            paramName,
            methods: new Map(),
            children: new Map(),
            middlewares: route.middlewares,
          });
        }
        currentNode = currentNode.children.get(paramKey)!;
      } else if (segment === "*") {
        currentNode.wildcard = route;
        return;
      }

      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, {
          path: segment,
          isParam: false,
          methods: new Map(),
          children: new Map(),
          middlewares: route.middlewares,
        });
      }
      currentNode = currentNode.children.get(segment)!;
    }

    currentNode.methods.set(route.method, route);
  }

  findRoute(
    path: string,
    method: HttpMethod
  ): { route: ServerRoute; params: Record<string, string> } | null {
    const segments = this.parsePath(path);
    const params: Record<string, string> = {};

    return this.findRouteRecursive(this.root, segments, 0, method, params);
  }

  private findRouteRecursive(
    node: RouteNode,
    segments: string[],
    index: number,
    method: HttpMethod,
    params: Record<string, string>
  ): { route: ServerRoute; params: Record<string, string> } | null {
    if (index >= segments.length) {
      const route = node.methods.get(method);
      return route ? { route, params } : null;
    }

    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (node.children.has(segment)) {
      const result = this.findRouteRecursive(
        node.children.get(segment)!,
        segments,
        index + 1,
        method,
        params
      );

      if (result) {
        return result;
      }
    }

    for (const [key, childNode] of node.children) {
      if (childNode.isParam) {
        params[childNode.paramName!] = segment;
        const result = this.findRouteRecursive(
          childNode,
          segments,
          index + 1,
          method,
          params
        );

        if (result) {
          return result;
        }

        delete params[childNode.paramName!]; // Backtrack
      }
    }

    if (isLast && node.wildcard && node.wildcard.method === method) {
      return { route: node.wildcard, params };
    }

    return null;
  }

  private parsePath(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  getAllRoutes(): ServerRoute[] {
    const routes: ServerRoute[] = [];
    this.collectRoutes(this.root, routes);
    return routes;
  }

  private collectRoutes(node: RouteNode, routes: ServerRoute[]): void {
    for (const route of node.methods.values()) {
      routes.push(route);
    }

    if (node.wildcard) {
      routes.push(node.wildcard);
    }

    for (const child of node.children.values()) {
      this.collectRoutes(child, routes);
    }
  }
}
