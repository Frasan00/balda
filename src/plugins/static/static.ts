import { errorFactory } from "../../errors/error_factory.js";
import { MethodNotAllowedError } from "../../errors/method_not_allowed.js";
import { RouteNotFoundError } from "../../errors/route_not_found.js";
import { SwaggerRouteOptions } from "../swagger/swagger_types.js";
import { nativeFile } from "../../runtime/native_file.js";
import { nativePath } from "../../runtime/native_path.js";
import { mimeTypesMap } from "../../plugins/static/static_constants.js";
import { nativeCwd } from "../../runtime/native_cwd.js";
import { nativeFs } from "../../runtime/native_fs.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import { router } from "../../server/router/router.js";
import type { StaticPluginOptions } from "./static_types.js";

/**
 * Creates a static file serving middleware and registers all routes for the given path
 * @param options - The options for serving static files
 * @param options.source - The file system directory path where the assets are located
 * @param options.path - The URL path where the assets will be served
 * @param swaggerOptions - Optional swagger documentation options
 * @example
 * serveStatic({ source: 'tmp/assets', path: '/assets' }) // Serves from ./tmp/assets at /assets/*
 *
 * @example
 * serveStatic({ source: 'public', path: '/public' }) // Serves from ./public at /public/*
 */
export const serveStatic = (
  options: StaticPluginOptions,
  swaggerOptions?: SwaggerRouteOptions,
): ServerRouteMiddleware => {
  const { source, path: urlPath } = options;

  // Normalize URL path
  let normalizedPath = urlPath;

  // Ensure path starts with /
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = "/" + normalizedPath;
  }

  // Remove trailing slash if present
  if (normalizedPath !== "/" && normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  // Static files handler
  router.addOrUpdate(
    "GET",
    `${normalizedPath}/*`,
    [],
    async (req, res) => {
      return staticFileHandler(req, res, source);
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
  const filePath = nativePath.join(path, wildcardPath);
  const resolvedPath = nativePath.resolve(nativeCwd.getCwd(), filePath);
  const sourcePath = nativePath.resolve(nativeCwd.getCwd(), path);
  if (!resolvedPath.startsWith(sourcePath)) {
    return res.notFound({
      ...errorFactory(new RouteNotFoundError(req.url, req.method)),
    });
  }

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

  const contentType = getContentType(nativePath.extName(resolvedPath));
  res.setHeader("Content-Type", contentType);
  const fileContent = nativeFile.file(resolvedPath);
  res.raw(fileContent);
}

export function getContentType(ext: string) {
  return mimeTypesMap.get(ext) || "application/octet-stream";
}
