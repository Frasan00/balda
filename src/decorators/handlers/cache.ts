import { MetadataStore } from "../../metadata_store.js";
import type { CacheRouteOptions } from "../../server/server_types.js";

/**
 * Decorator to enable caching for a GET route handler
 * @param options - Cache options (ttl, key override)
 * @warning This decorator can only be used on GET routes. Using it on other HTTP methods will throw an error during controller registration.
 * @example
 * ```ts
 * import { get, cache, controller, Request, Response } from "balda";
 *
 * @controller("/api")
 * class MyController {
 *   @get("/users/:id")
 *   @cache({ ttl: 60000 }) // Cache for 60 seconds
 *   async getUser(req: Request<{ id: string }>, res: Response) {
 *     const user = await fetchUser(req.params.id);
 *     res.json(user);
 *   }
 *
 *   @get("/profile")
 *   @cache({ key: "current-user-profile", ttl: 30000 }) // Custom key override
 *   async getProfile(req: Request, res: Response) {
 *     const profile = await fetchCurrentUserProfile();
 *     res.json(profile);
 *   }
 * }
 * ```
 */
export const cache = (options?: CacheRouteOptions) => {
  return (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [] };
    }

    meta.cache = options ?? {};

    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
