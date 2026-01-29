import { openapiSchemaMap } from "./openapi_schema_map.js";
import { jsonSchemaCache, clearJsonSchemaCache } from "./json_schema_cache.js";
import {
  fastJsonStringifyMap,
  getSerializerCacheStats,
  clearSerializerCache,
} from "./fast_json_stringify_cache.js";
import { getSchemaRefCount } from "./schema_ref_cache.js";
import { logger } from "../logger/logger.js";

/**
 * Cache metrics for monitoring schema compilation and serialization caches
 */
export interface CacheMetrics {
  validators: {
    size: number;
    maxSize: number;
    description: string;
  };
  serializers: {
    size: number;
    maxSize: number;
    schemaRefsCreated: number;
    entries: Array<{
      key: string;
      compiledAt: number;
      schemaType: string;
    }>;
  };
  jsonSchemas: {
    size: number;
    maxSize: number;
    description: string;
  };
  totalSchemaReferences: number;
  memoryEstimate: {
    validators: string;
    serializers: string;
    jsonSchemas: string;
    total: string;
  };
}

/**
 * Gets comprehensive metrics about all schema caches.
 * Useful for monitoring memory usage and cache effectiveness.
 *
 * @returns Cache metrics including sizes, memory estimates, and detailed entries
 *
 * @example
 * ```ts
 * const metrics = getCacheMetrics();
 * console.log(`Total validators cached: ${metrics.validators.size}`);
 * console.log(`Memory estimate: ${metrics.memoryEstimate.total}`);
 * ```
 */
export const getCacheMetrics = (): CacheMetrics => {
  const serializerStats = getSerializerCacheStats();

  // Estimate memory usage (rough approximation)
  // Each validator: ~1-5KB, serializer: ~2-10KB, JSON schema: ~0.5-2KB
  const validatorMemoryKB = openapiSchemaMap.size * 3;
  const serializerMemoryKB = serializerStats.size * 6;
  const jsonSchemaMemoryKB = jsonSchemaCache.size * 1;
  const totalMemoryKB =
    validatorMemoryKB + serializerMemoryKB + jsonSchemaMemoryKB;

  const formatMemory = (kb: number): string => {
    if (kb < 1024) {
      return `~${kb}KB`;
    }

    return `~${(kb / 1024).toFixed(2)}MB`;
  };

  return {
    validators: {
      size: openapiSchemaMap.size,
      maxSize: openapiSchemaMap.getMaxSize(),
      description: "Compiled AJV validators for request/response validation",
    },
    serializers: {
      size: serializerStats.size,
      maxSize: serializerStats.maxSize,
      schemaRefsCreated: serializerStats.schemaRefsCreated,
      entries: serializerStats.entries,
    },
    jsonSchemas: {
      size: jsonSchemaCache.size,
      maxSize: jsonSchemaCache.getMaxSize(),
      description: "Converted JSON schemas for Swagger/OpenAPI documentation",
    },
    totalSchemaReferences: getSchemaRefCount(),
    memoryEstimate: {
      validators: formatMemory(validatorMemoryKB),
      serializers: formatMemory(serializerMemoryKB),
      jsonSchemas: formatMemory(jsonSchemaMemoryKB),
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
      serializers: metrics.serializers.size,
      jsonSchemas: metrics.jsonSchemas.size,
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
  openapiSchemaMap.clear();
  clearSerializerCache();
  clearJsonSchemaCache();
  logger.debug("All schema caches cleared");
};
