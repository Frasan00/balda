import { extname, join, resolve } from "node:path";
import { errorFactory } from "src/errors/error_factory";
import { MethodNotAllowedError } from "src/errors/method_not_allowed";
import { RouteNotFoundError } from "src/errors/route_not_found";
import { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { nativeFile } from "src/runtime/native_file";
import { mimeTypes } from "../../plugins/static/static_constants";
import { nativeCwd } from "../../runtime/native_cwd";
import { nativeFs } from "../../runtime/native_fs";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import { router } from "../../server/router/router";

/**
 * Creates a static file serving middleware and registers all routes for the given path (path + "/*")
 * @param path - The api path to serve static files from.
 * @example 'public' -> localhost:3000/public/index.html will search for public/index.html in the current directory
 */
export const serveStatic = (
  path: string = "public",
  swaggerOptions?: SwaggerRouteOptions,
): ServerRouteMiddleware => {
  // Static files handler
  router.addOrUpdate(
    "GET",
    `${path}/*`,
    [],
    async (req, res) => {
      return staticFileHandler(req, res, path);
    },
    {
      service: "StaticFiles",
      ...swaggerOptions,
    },
  );

  return async (_req: Request, _res: Response, next: NextFunction) => {
    return next();
  };
};

async function staticFileHandler(req: Request, res: Response, path: string) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({
      ...errorFactory(new MethodNotAllowedError(req.url, req.method)),
    });
  }

  const wildcardPath = req.params["*"] || "";
  const filePath = join(path, wildcardPath);
  const resolvedPath = resolve(nativeCwd.getCwd(), filePath);

  try {
    const stats = await nativeFs.stat(resolvedPath);
    if (!stats.isFile) {
      return res.notFound({
        ...errorFactory(new RouteNotFoundError(req.url, req.method)),
      });
    }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return res.notFound({
        ...errorFactory(new RouteNotFoundError(req.url, req.method)),
      });
    }
    throw error;
  }

  const contentType = getContentType(extname(resolvedPath));
  res.setHeader("Content-Type", contentType);
  const fileContent = await nativeFile.file(resolvedPath);
  res.raw(fileContent);
}

export function getContentType(ext: string) {
  return mimeTypes.get(ext) || "application/octet-stream";
}
