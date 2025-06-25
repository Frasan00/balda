import type {
  HttpMethod,
  ServerRoute,
  ServerRouteMiddleware,
} from "../native_server/server_types";

interface RouteNode {
  path: string;
  isParam: boolean;
  paramName?: string;
  methods: Map<HttpMethod, ServerRoute>;
  children: Map<string, RouteNode>;
  paramChild?: RouteNode;
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
    let node = this.root;

    for (const segment of segments) {
      if (segment === "*") {
        node.wildcard = route;
        return;
      }

      if (segment.startsWith(':')) {
        if (!node.paramChild) {
          const paramName = segment.slice(1);
          node.paramChild = {
            path: segment,
            isParam: true,
            paramName,
            methods: new Map(),
            children: new Map(),
            middlewares: route.middlewares,
          };
        }
        node = node.paramChild;
      } else {
        let child = node.children.get(segment);
        if (!child) {
          child = {
            path: segment,
            isParam: false,
            methods: new Map(),
            children: new Map(),
            middlewares: route.middlewares,
          };
          node.children.set(segment, child);
        }
        node = child;
      }
    }

    node.methods.set(route.method, route);
  }

  findRoute(
    path: string,
    method: HttpMethod
  ): { route: ServerRoute; params: Record<string, string> } | null {
    const segments = this.parsePath(path);
    const params: Record<string, string> = {};
    let node: RouteNode = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      // try exact static match
      const next = node.children.get(segment)
        // or param match
        ?? node.paramChild;

      if (!next) {
        // wildcard match on last segment
        if (isLast && node.wildcard && node.wildcard.method === method) {
          return { route: node.wildcard, params };
        }
        return null;
      }

      if (next.isParam && next.paramName) {
        params[next.paramName] = segment;
      }

      node = next;
    }

    const found = node.methods.get(method);
    return found ? { route: found, params } : null;
  }

  getAllRoutes(): ServerRoute[] {
    const routes: ServerRoute[] = [];
    const stack: RouteNode[] = [this.root];

    while (stack.length) {
      const node = stack.pop()!;
      for (const route of node.methods.values()) routes.push(route);
      if (node.wildcard) routes.push(node.wildcard);
      node.children.forEach(child => stack.push(child));
      if (node.paramChild) stack.push(node.paramChild);
    }

    return routes;
  }

  private parsePath(path: string): string[] {
    return path.split('?')[0].split('/').filter(Boolean);
  }
}
