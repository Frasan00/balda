import type {
  CachePluginOptionsResolved,
  CacheProvider,
} from "./cache.types.js";
import { CacheService } from "./cache.service.js";
import { DEFAULT_CACHE_OPTIONS } from "./cache.constants.js";

/**
 * Global cache service instance, set during server bootstrap.
 * Used by `@controller` decorator to inject cache middleware.
 */
let globalCacheService: CacheService | null = null;
let globalCacheOptions: CachePluginOptionsResolved = {
  ...DEFAULT_CACHE_OPTIONS,
};

/**
 * Initialize the global cache service with a provider and options.
 * Called during server bootstrap when `cache` is configured in ServerOptions.
 * @internal
 */
export function initCacheService(
  provider: CacheProvider,
  options: CachePluginOptionsResolved,
): CacheService {
  globalCacheService = new CacheService(provider, options);
  globalCacheOptions = options;
  return globalCacheService;
}

/**
 * Get the global cache service instance.
 * Returns null if cache has not been configured.
 */
export function getCacheService(): CacheService | null {
  return globalCacheService;
}

/**
 * Get the global resolved cache plugin options.
 */
export function getCacheOptions(): CachePluginOptionsResolved {
  return globalCacheOptions;
}

/**
 * Reset the global cache service (for testing).
 * @internal
 */
export function resetCacheService(): void {
  globalCacheService = null;
  globalCacheOptions = { ...DEFAULT_CACHE_OPTIONS };
}
