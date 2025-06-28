import { extname, join, resolve } from "node:path";
import { routeNotFoundError } from "../../errors/errors_constants";
import { mimeTypes } from "../../plugins/static/static_constants";
import { nativeCwd } from "../../runtime/native_cwd";
import { nativeFs } from "../../runtime/native_fs";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import { router } from "../../server/router/router";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import { nativeFile } from "src/runtime/native_file";
import { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";

/**
 * Creates a static file serving middleware and registers all routes for the given path (path + "/*")
 * @param path - The api path to serve static files from.
 * @example 'public' -> localhost:3000/public/index.html will search for public/index.html in the current directory
 */
export const serveStatic = (
  path: string = "public",
  swaggerOptions?: SwaggerRouteOptions
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
    }
  );

  return async (_req: Request, _res: Response, next: NextFunction) => {
    return next();
  };
};

async function staticFileHandler(req: Request, res: Response, path: string) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const wildcardPath = req.params["*"] || "";
    const filePath = join(path, wildcardPath);
    const resolvedPath = resolve(nativeCwd.getCwd(), filePath);

    const stats = await nativeFs.stat(resolvedPath);
    if (!stats.isFile) {
      return res.notFound(routeNotFoundError.error);
    }

    const contentType = getContentType(extname(resolvedPath));
    res.setHeader("Content-Type", contentType);
    const fileContent = await nativeFile.file(resolvedPath);
    res.raw(fileContent);
  } catch (error) {
    return res.notFound(routeNotFoundError.error);
  }
}

export function getContentType(ext: string) {
  return mimeTypes.get(ext) || "application/octet-stream";
}
