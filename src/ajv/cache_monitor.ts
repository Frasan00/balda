import { AjvStateManager } from "./ajv.js";
import { logger } from "../logger/logger.js";

/**
 * Cache metrics for monitoring schema compilation and serialization caches
 */
export interface CacheMetrics {
  validators: {
    size: number;
    description: string;
  };
  totalSchemaReferences: number;
  memoryEstimate: {
    validators: string;
    total: string;
  };
}

/**
 * Gets comprehensive metrics about all schema caches.
 * Useful for monitoring memory usage and cache effectiveness.
 *
 * @returns Cache metrics including sizes and memory estimates
 *
 * @example
 * ```ts
 * const metrics = getCacheMetrics();
 * console.log(`Total validators cached: ${metrics.validators.size}`);
 * console.log(`Memory estimate: ${metrics.memoryEstimate.total}`);
 * ```
 */
export const getCacheMetrics = (): CacheMetrics => {
  const stats = AjvStateManager.getCacheStats();

  // Estimate memory usage (rough approximation)
  // Each validator: ~1-5KB, serializer: ~2-10KB
  const validatorMemoryKB = stats.schemaCount * 3;
  const totalMemoryKB = validatorMemoryKB;

  const formatMemory = (kb: number): string => {
    if (kb < 1024) {
      return `~${kb}KB`;
    }

    return `~${(kb / 1024).toFixed(2)}MB`;
  };

  return {
    validators: {
      size: stats.schemaCount,
      description:
        "Compiled schemas stored in Ajv for validation and serialization",
    },
    totalSchemaReferences: stats.totalRefsCreated,
    memoryEstimate: {
      validators: formatMemory(validatorMemoryKB),
      total: formatMemory(totalMemoryKB),
    },
  };
};

/**
 * Logs cache metrics to the console using the logger.
 * Useful for debugging and monitoring cache behavior.
 *
 * @example
 * ```ts
 * // Log metrics at server startup
 * server.listen(() => {
 *   logCacheMetrics();
 * });
 * ```
 */
export const logCacheMetrics = (): void => {
  const metrics = getCacheMetrics();

  logger.info(
    {
      validators: metrics.validators.size,
      totalSchemaRefs: metrics.totalSchemaReferences,
      memoryEstimate: metrics.memoryEstimate.total,
    },
    "Schema cache metrics",
  );
};

/**
 * Clears all schema caches.
 * This is primarily useful for testing or memory management in long-running processes.
 *
 * @warning This will cause all schemas to be recompiled on next use, which may impact performance.
 *
 * @example
 * ```ts
 * // Clear all caches during hot reload or memory pressure
 * clearAllCaches();
 * ```
 */
export const clearAllCaches = (): void => {
  AjvStateManager.clearAllCaches();
  logger.debug("All schema caches cleared");
};
