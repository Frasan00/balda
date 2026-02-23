import type { ServerRouteMiddleware } from "../runtime/native_server/server_types.js";
import type { CachePluginOptions, CacheProvider } from "./cache.types.js";
import { DEFAULT_CACHE_OPTIONS } from "./cache.constants.js";
import { initCacheService } from "./cache.registry.js";

/**
 * Options for the cache middleware.
 * Accepts the same configuration as CachePluginOptions but without provider/redis
 * since the provider is passed directly as the first argument.
 */
export type CacheMiddlewareOptions = Omit<
  CachePluginOptions,
  "provider" | "redis"
>;

/**
 * Creates a cache middleware that initializes the global CacheService.
 *
 * Use with `server.use()` to enable caching across your application.
 * The `@cache()` decorator and `getCacheService()` will use the initialized service.
 *
 * @param provider - The cache provider instance (e.g. `new MemoryCacheProvider()` or `new RedisCacheProvider(...)`)
 * @param options - Optional cache configuration (defaults are applied automatically)
 * @returns A middleware compatible with `server.use()`
 *
 * @example
 * ```typescript
 * import { Server, cacheMiddleware, MemoryCacheProvider } from 'balda';
 *
 * const server = new Server({ port: 3000 });
 * server.use(cacheMiddleware(new MemoryCacheProvider()));
 * ```
 *
 * @example
 * ```typescript
 * import { Server, cacheMiddleware, RedisCacheProvider } from 'balda';
 *
 * const server = new Server({ port: 3000 });
 * server.use(cacheMiddleware(new RedisCacheProvider({ host: 'localhost' }), {
 *   defaultTtl: 600,
 *   enableStats: true,
 * }));
 * ```
 */
export function cacheMiddleware(
  provider: CacheProvider,
  options?: CacheMiddlewareOptions,
): ServerRouteMiddleware {
  const resolvedOptions = {
    ...DEFAULT_CACHE_OPTIONS,
    ...(options?.defaultTtl !== undefined && {
      defaultTtl: options.defaultTtl,
    }),
    ...(options?.compressionThreshold !== undefined && {
      compressionThreshold: options.compressionThreshold,
    }),
    ...(options?.keyPrefix !== undefined && { keyPrefix: options.keyPrefix }),
    ...(options?.enableStats !== undefined && {
      enableStats: options.enableStats,
    }),
    ...(options?.lockTimeout !== undefined && {
      lockTimeout: options.lockTimeout,
    }),
    ...(options?.lockBehavior !== undefined && {
      lockBehavior: options.lockBehavior,
    }),
  };

  initCacheService(provider, resolvedOptions);

  return async (_req, _res, next) => {
    await next();
  };
}
