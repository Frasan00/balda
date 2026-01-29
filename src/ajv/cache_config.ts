/**
 * Configuration for schema validation and serialization caches.
 * These settings control the maximum size of various schema-related caches
 * to prevent unbounded memory growth.
 */
export interface SchemaCacheConfig {
  /**
   * Maximum number of entries in the fast-json-stringify serializer cache.
   * Default: 1000
   */
  maxSerializerCacheSize: number;

  /**
   * Maximum number of entries in the AJV validator cache (openapiSchemaMap).
   * Default: 1000
   */
  maxValidatorCacheSize: number;

  /**
   * Maximum number of entries in the JSON Schema cache.
   * Default: 1000
   */
  maxJsonSchemaCacheSize: number;
}

/**
 * Default schema cache configuration.
 * Can be overridden by calling setSchemaCacheConfig().
 */
const defaultSchemaCacheConfig: SchemaCacheConfig = {
  maxSerializerCacheSize: 1000,
  maxValidatorCacheSize: 1000,
  maxJsonSchemaCacheSize: 1000,
};

let currentSchemaCacheConfig: SchemaCacheConfig = {
  ...defaultSchemaCacheConfig,
};

/**
 * Get the current schema cache configuration.
 */
export const getSchemaCacheConfig = (): Readonly<SchemaCacheConfig> => {
  return { ...currentSchemaCacheConfig };
};

/**
 * Set custom schema cache configuration.
 * Partial configuration is supported - only provided values will be updated.
 *
 * @param config - Partial schema cache configuration to merge with current settings
 *
 * @example
 * ```ts
 * setSchemaCacheConfig({ maxSerializerCacheSize: 2000 });
 * ```
 */
export const setSchemaCacheConfig = (
  config: Partial<SchemaCacheConfig>,
): void => {
  currentSchemaCacheConfig = { ...currentSchemaCacheConfig, ...config };
};

/**
 * Reset schema cache configuration to defaults.
 */
export const resetSchemaCacheConfig = (): void => {
  currentSchemaCacheConfig = { ...defaultSchemaCacheConfig };
};
