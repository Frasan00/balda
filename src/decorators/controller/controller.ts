import { join } from "node:path";
import type { HttpMethod } from "../../runtime/native_server/server_types";
import { MetadataStore } from "../../metadata_store";
import { router } from "../../server/router/router";

/**
 * Decorator to mark a class as a controller, routes defined in the controller will be registered at import time when calling the `listen` method.
 * You can customize the path pattern for controller imports in the server options `controllerPatterns`
 */
export const controller = (path?: string) => {
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
        meta.documentation,
      );
    }

    MetadataStore.clear(target.prototype);
  };
};
