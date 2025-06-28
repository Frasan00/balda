import { join } from "node:path";
import type { HttpMethod } from "../../runtime/native_server/server_types";
import { MetadataStore } from "../../metadata_store";
import { router } from "../../server/router/router";
import { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";

/**
 * Decorator to mark a class as a controller, routes defined in the controller will be registered at import time when calling the `listen` method.
 * You can customize the path pattern for controller imports in the server options `controllerPatterns`
 * @param path - The path pattern for the controller.
 * @param swaggerOptions - The swagger options for the controller that will be applied to all routes defined in the controller. Controller options will override route options.
 * @swagger If swagger is enabled, the default service name for all routes defined in the controller will be the controller name.
 * @swagger For naming commodity, the default service name will remove the "Controller" suffix if it exists. e.g. "UserController" -> "User"
 */
export const controller = (
  path?: string,
  swaggerOptions?: SwaggerRouteOptions,
) => {
  return (target: any) => {
    const classMeta = MetadataStore.get(target.prototype, "__class__");
    const classMiddlewares = classMeta?.middlewares || [];
    const metaMap = MetadataStore.getAll(target.prototype);
    for (const [propertyKey, meta] of metaMap.entries()) {
      if (!meta.route) {
        continue;
      }

      const handler = target.prototype[propertyKey];
      const fullPath = path ? join(path, meta.route.path) : meta.route.path;

      // Prepend class-level middlewares before route-level
      const allMiddlewares = [...classMiddlewares, ...(meta.middlewares || [])];
      router.addOrUpdate(
        meta.route.method as HttpMethod,
        fullPath,
        allMiddlewares,
        handler,
        {
          // default service name
          service: target.name.replace(/Controller$/, ""),
          // controller options
          ...swaggerOptions,
          // route options
          ...meta.documentation,
        },
      );
    }

    MetadataStore.clear(target.prototype);
  };
};
