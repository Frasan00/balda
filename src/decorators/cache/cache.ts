import { MetadataStore } from "../../metadata_store.js";
import type { CacheRouteConfig } from "../../cache/cache.types.js";

/**
 * Decorator to enable caching for a controller route handler.
 *
 * Stores cache configuration in MetadataStore, which is processed
 * by the `@controller` decorator to inject cache middleware.
 *
 * **Note:** `include` field picks are not type-safe in decorators since
 * the decorator doesn't have access to body/query schema types.
 * Use the inline router config with schemas for type-safe picks.
 *
 * @param config - Cache configuration for the route
 *
 * @example
 * ```typescript
 * import { controller, get, cache } from "balda";
 *
 * @controller("/api/users")
 * class UserController {
 *   @get("/")
 *   @cache({ ttl: 120 })
 *   async listUsers(req, res) {
 *     return await db.users.findAll();
 *   }
 *
 *   @get("/:id")
 *   @cache({
 *     ttl: 60,
 *     tags: ["users"],
 *     include: { query: ["fields"] },
 *   })
 *   async getUser(req, res) {
 *     return await db.users.findById(req.params.id);
 *   }
 * }
 * ```
 */
export const cache = (config: CacheRouteConfig) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [] };
    }

    meta.cacheConfig = config;
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
