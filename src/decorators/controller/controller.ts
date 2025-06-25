import { join } from "node:path";
import { MetadataStore } from "../../metadata_store";
import { router } from "../../runtime/router/router";

/**
 * Decorator to mark a class as a controller
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
      router.addOrUpdateRoute({
        path: fullPath,
        method: meta.route.method as any,
        handler,
        middlewares: allMiddlewares,
      });
    }

    MetadataStore.clear(target.prototype);
  };
};
