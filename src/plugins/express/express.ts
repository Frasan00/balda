import type {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  Router as ExpressRouter,
  RequestHandler,
} from "express";
import type {
  HttpMethod,
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "src/runtime/native_server/server_types";
import type { NextFunction } from "src/server/http/next";
import type { Request as BaldaRequest } from "src/server/http/request";
import type { Response as BaldaResponse } from "src/server/http/response";
import { router } from "src/server/router/router";

/**
 * Converts a Balda Request to an Express-compatible request object
 */
function toBaldaToExpressRequest(
  baldaReq: BaldaRequest,
  basePath: string = "",
): ExpressRequest {
  const url = new URL(baldaReq.url);
  const headersObj = Object.fromEntries(baldaReq.headers.entries());

  const expressReq = {
    body: baldaReq.body,
    query: baldaReq.query as any,
    params: baldaReq.params,
    cookies: baldaReq.cookies,
    session: baldaReq.session,
    originalUrl: url.pathname + url.search,
    baseUrl: basePath,
    path: url.pathname.replace(basePath, "") || "/",
    method: baldaReq.method,
    ip: baldaReq.ip,
    headers: headersObj,
    url: url.pathname,
    get(name: string) {
      return baldaReq.headers.get(name.toLowerCase()) ?? undefined;
    },
    header(name: string) {
      return baldaReq.headers.get(name.toLowerCase()) ?? undefined;
    },
    app: {},
    res: null,
    route: null,
    protocol: url.protocol.replace(":", ""),
    secure: url.protocol === "https:",
    hostname: url.hostname,
    host: url.host,
    fresh: false,
    stale: true,
    xhr: headersObj["x-requested-with"]?.toLowerCase() === "xmlhttprequest",
    accepts: () => undefined,
    acceptsCharsets: () => undefined,
    acceptsEncodings: () => undefined,
    acceptsLanguages: () => undefined,
    is: () => null,
    range: () => undefined,
    param: (name: string) => baldaReq.params[name] ?? baldaReq.query[name],
    files: baldaReq.files,
    file: baldaReq.file,
    rawBody: baldaReq.rawBody,
  } as unknown as ExpressRequest;

  return expressReq;
}

interface ExpressResponseWrapper {
  locals: Record<string, any>;
  headersSent: boolean;
  statusCode: number;
  status(code: number): this;
  sendStatus(code: number): this;
  send(body?: any): this;
  json(body?: any): this;
  redirect(statusOrUrl: number | string, url?: string): this;
  setHeader(name: string, value: string | number | readonly string[]): this;
  set(field: string | Record<string, string>, value?: string): this;
  header(field: string | Record<string, string>, value?: string): this;
  type(contentType: string): this;
  contentType(type: string): this;
  end(data?: any): this;
  write(chunk: any): boolean;
  get(name: string): string | undefined;
  getHeader(name: string): string | undefined;
  removeHeader(name: string): this;
  append(field: string, value: string | string[]): this;
  cookie(name: string, value: string, options?: any): this;
  clearCookie(name: string, options?: any): this;
  render(view: string, options?: any, callback?: any): void;
  format(obj: any): this;
  attachment(filename?: string): this;
  sendFile(path: string, options?: any, fn?: any): void;
  download(
    path: string,
    filename?: string | any,
    options?: any,
    fn?: any,
  ): void;
  links(links: Record<string, string>): this;
  location(url: string): this;
  vary(field: string): this;
  app: Record<string, any>;
  req: null;
}

/**
 * Creates an Express-compatible response wrapper around Balda Response
 */
function createExpressResponse(baldaRes: BaldaResponse): ExpressResponse {
  const expressRes: ExpressResponseWrapper = {
    locals: {},
    headersSent: false,
    statusCode: baldaRes.responseStatus,

    status(code: number) {
      baldaRes.status(code);
      this.statusCode = code;
      return this;
    },

    sendStatus(code: number) {
      this.status(code).send(String(code));
      return this;
    },

    send(body?: any) {
      this.headersSent = true;
      const hasContentType = !!baldaRes.headers["Content-Type"];

      if (!hasContentType && typeof body === "string") {
        const trimmed = body.trim();
        if (
          trimmed.startsWith("<!DOCTYPE") ||
          trimmed.startsWith("<html") ||
          trimmed.startsWith("<HTML")
        ) {
          baldaRes.html(body);
          return this;
        }
      }

      baldaRes.send(body);
      return this;
    },

    json(body?: any) {
      this.headersSent = true;
      baldaRes.json(body);
      return this;
    },

    redirect(statusOrUrl: number | string, url?: string) {
      this.headersSent = true;
      const redirectUrl = typeof statusOrUrl === "string" ? statusOrUrl : url!;
      const status = typeof statusOrUrl === "number" ? statusOrUrl : 302;
      baldaRes.status(status).setHeader("Location", redirectUrl);
      baldaRes.send("");
      return this;
    },

    setHeader(name: string, value: string | number | readonly string[]) {
      const stringValue = Array.isArray(value)
        ? value.join(", ")
        : String(value);
      baldaRes.setHeader(name, stringValue);
      return this;
    },

    set(field: string | Record<string, string>, value?: string) {
      if (typeof field === "object") {
        for (const [key, val] of Object.entries(field)) {
          baldaRes.setHeader(key, val);
        }
      } else if (value !== undefined) {
        baldaRes.setHeader(field, value);
      }
      return this;
    },

    header(field: string | Record<string, string>, value?: string) {
      return this.set(field, value);
    },

    type(contentType: string) {
      baldaRes.setHeader("Content-Type", contentType);
      return this;
    },

    contentType(type: string) {
      return this.type(type);
    },

    end(data?: any) {
      this.headersSent = true;
      baldaRes.send(data ?? "");
      return this;
    },

    write(chunk: any) {
      return true;
    },

    get(name: string) {
      return baldaRes.headers[name];
    },

    getHeader(name: string) {
      return baldaRes.headers[name];
    },

    removeHeader(name: string) {
      delete baldaRes.headers[name];
      return this;
    },

    append(field: string, value: string | string[]) {
      const prev = baldaRes.headers[field];
      const newValue = Array.isArray(value) ? value.join(", ") : value;
      baldaRes.setHeader(field, prev ? `${prev}, ${newValue}` : newValue);
      return this;
    },

    cookie(name: string, value: string, options?: any) {
      baldaRes.cookie?.(name, value, options);
      return this;
    },

    clearCookie(name: string, options?: any) {
      baldaRes.clearCookie?.(name, options);
      return this;
    },

    render(view: string, options?: any, callback?: any) {
      throw new Error(
        "render() is not supported in Express compatibility layer",
      );
    },

    format(obj: any) {
      return this;
    },

    attachment(filename?: string) {
      if (filename) {
        baldaRes.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
      } else {
        baldaRes.setHeader("Content-Disposition", "attachment");
      }
      return this;
    },

    sendFile(path: string, options?: any, fn?: any) {
      baldaRes.file(path);
    },

    download(path: string, filename?: string | any, options?: any, fn?: any) {
      const fname =
        typeof filename === "string" ? filename : path.split("/").pop();
      this.attachment(fname);
      baldaRes.file(path);
    },

    links(links: Record<string, string>) {
      const link = Object.entries(links)
        .map(([rel, url]) => `<${url}>; rel="${rel}"`)
        .join(", ");
      baldaRes.setHeader("Link", link);
      return this;
    },

    location(url: string) {
      baldaRes.setHeader("Location", url);
      return this;
    },

    vary(field: string) {
      baldaRes.setHeader("Vary", field);
      return this;
    },

    app: {},
    req: null,
  };

  return expressRes as unknown as ExpressResponse;
}

/**
 * Converts an Express middleware to a Balda middleware
 */
export function expressMiddleware(
  expressHandler: RequestHandler,
  basePath: string = "",
): ServerRouteMiddleware {
  return async (
    baldaReq: BaldaRequest,
    baldaRes: BaldaResponse,
    next: NextFunction,
  ) => {
    const expressReq = toBaldaToExpressRequest(baldaReq, basePath);
    const expressRes = createExpressResponse(baldaRes);

    await new Promise<void>((resolve, reject) => {
      const expressNext: ExpressNextFunction = (err?: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };

      try {
        const result = expressHandler(expressReq, expressRes, expressNext);
        if (result instanceof Promise) {
          result.catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });

    await next();
  };
}

/**
 * Converts an Express handler to a Balda handler
 */
export function expressHandler(
  handler: RequestHandler,
  basePath: string = "",
): ServerRouteHandler {
  return async (baldaReq: BaldaRequest, baldaRes: BaldaResponse) => {
    const expressReq = toBaldaToExpressRequest(baldaReq, basePath);
    const expressRes = createExpressResponse(baldaRes);

    const next: ExpressNextFunction = () => {};
    await handler(expressReq, expressRes, next);
  };
}

interface RouterLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      handle: RequestHandler;
      method?: string;
    }>;
  };
  handle?: RequestHandler | ExpressRouter;
  regexp?: RegExp;
  path?: string;
  name?: string;
}

/**
 * Mounts an Express router at a specific base path
 * This extracts all routes from the Express router and registers them with Balda
 */
export function mountExpressRouter(
  basePath: string,
  expressRouter: ExpressRouter,
): void {
  const normalizedBase = normalizePath(basePath);
  const stack = (expressRouter as any).stack as RouterLayer[] | undefined;

  if (!stack) {
    console.warn("Express router has no stack - routes may not be registered");
    return;
  }

  for (const layer of stack) {
    processExpressLayer(layer, normalizedBase);
  }
}

function processExpressLayer(layer: RouterLayer, basePath: string): void {
  if (layer.route) {
    const routePath = normalizePath(basePath + layer.route.path);
    const methods = Object.keys(layer.route.methods).filter(
      (m) => layer.route!.methods[m],
    );

    for (const method of methods) {
      const handlers = layer.route.stack.map((s) => s.handle);
      registerExpressHandlers(
        method.toUpperCase() as HttpMethod,
        routePath,
        handlers,
        basePath,
      );
    }
    return;
  }

  if (layer.handle && typeof layer.handle === "function") {
    const layerPath = layer.path || "";
    const fullPath = normalizePath(basePath + layerPath);
    const layerStack = (layer.handle as any).stack as RouterLayer[] | undefined;

    if (layerStack && Array.isArray(layerStack)) {
      for (const subLayer of layerStack) {
        processExpressLayer(subLayer, fullPath);
      }
      return;
    }

    const wildcardPath = fullPath === "/" ? "/*" : `${fullPath}/*`;
    const middleware = expressMiddleware(
      layer.handle as RequestHandler,
      basePath,
    );

    const methods: HttpMethod[] = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ];
    for (const method of methods) {
      router.addOrUpdate(method, wildcardPath, [middleware], async () => {}, {
        excludeFromSwagger: true,
      });
    }
  }
}

function registerExpressHandlers(
  method: HttpMethod,
  path: string,
  handlers: RequestHandler[],
  basePath: string,
): void {
  const middlewares: ServerRouteMiddleware[] = handlers
    .slice(0, -1)
    .map((h) => expressMiddleware(h, basePath));

  const lastHandler = handlers[handlers.length - 1];
  const finalHandler = expressHandler(lastHandler, basePath);

  router.addOrUpdate(method, path, middlewares, finalHandler, {
    excludeFromSwagger: true,
  });
}

function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Creates an Express adapter that provides a use method for mounting Express middleware/routers
 *
 * @example
 * ```ts
 * import AdminJS from 'adminjs'
 * import AdminJSExpress from '@adminjs/express'
 * import { createExpressAdapter } from 'balda'
 *
 * const admin = new AdminJS({...})
 * const adminRouter = AdminJSExpress.buildRouter(admin)
 *
 * const server = new Server()
 * const express = createExpressAdapter(server)
 * express.use('/admin', adminRouter)
 * ```
 */
export function createExpressAdapter(server: {
  use: (...middlewares: ServerRouteMiddleware[]) => void;
}) {
  return {
    use(
      pathOrMiddleware: string | RequestHandler | ExpressRouter,
      maybeMiddleware?: RequestHandler | ExpressRouter,
    ) {
      if (typeof pathOrMiddleware === "string") {
        const path = pathOrMiddleware;
        const middleware = maybeMiddleware!;
        const middlewareStack = (middleware as any).stack;

        if (middlewareStack && Array.isArray(middlewareStack)) {
          mountExpressRouter(path, middleware as ExpressRouter);
          return;
        }

        server.use(expressMiddleware(middleware as RequestHandler, path));
        return;
      }

      const middleware = pathOrMiddleware;
      const middlewareStack = (middleware as any).stack;

      if (middlewareStack && Array.isArray(middlewareStack)) {
        mountExpressRouter("/", middleware as ExpressRouter);
        return;
      }

      server.use(expressMiddleware(middleware as RequestHandler));
    },
  };
}
