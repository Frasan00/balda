import type { RequestSchema } from "../decorators/validation/validate_types.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { ZodLoader } from "../validator/zod_loader.js";
import { getSchemaRefKey } from "./schema_ref_cache.js";

/**
 * Maps schemas to their converted JSON Schema (OpenAPI format).
 * This cache stores the intermediate JSON Schema representation that is used by:
 * - Swagger/OpenAPI documentation generation
 * - Schema introspection and validation
 *
 * Parallel to openapiSchemaMap (which stores compiled AJV validators),
 * this map stores the JSON Schema format before compilation.
 *
 * Uses Symbol (for object schema references) or string (for primitive schemas) as cache keys.
 */
export const jsonSchemaCache = new Map<symbol | string, JSONSchema>();

/**
 * Retrieves a cached JSON Schema for the given schema object.
 * Returns undefined if the schema is not in cache.
 *
 * This function is used by the Swagger plugin to get pre-converted schemas
 * without repeatedly calling toJSONSchema() on Zod schemas.
 *
 * @param schema - The schema to look up (Zod, TypeBox, or plain JSON schema)
 * @returns The cached JSON Schema, or undefined if not found
 *
 * @example
 * ```ts
 * const zodSchema = z.object({ name: z.string() });
 * // After route registration, the schema is cached
 * const jsonSchema = getJsonSchemaFromCache(zodSchema);
 * // Use jsonSchema for OpenAPI spec generation
 * ```
 */
export const getJsonSchemaFromCache = (
  schema: RequestSchema,
): JSONSchema | undefined => {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  if (ZodLoader.isZodSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "json_schema_zod");
    return jsonSchemaCache.get(refKey);
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "json_schema_typebox");
    return jsonSchemaCache.get(refKey);
  }

  // Plain JSON schema
  const refKey = getSchemaRefKey(schema, "json_schema_json");
  return jsonSchemaCache.get(refKey);
};

/**
 * Caches a JSON Schema with the appropriate cache key based on schema type.
 *
 * @param schema - The original schema object (Zod, TypeBox, or plain JSON)
 * @param jsonSchema - The converted JSON Schema to cache
 * @internal
 */
export const cacheJsonSchema = (
  schema: RequestSchema,
  jsonSchema: JSONSchema,
): void => {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (ZodLoader.isZodSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "json_schema_zod");
    jsonSchemaCache.set(refKey, jsonSchema);
    return;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "json_schema_typebox");
    jsonSchemaCache.set(refKey, jsonSchema);
    return;
  }

  // Plain JSON schema
  const refKey = getSchemaRefKey(schema, "json_schema_json");
  jsonSchemaCache.set(refKey, jsonSchema);
};

/**
 * Clears the JSON Schema cache.
 * Useful for testing or memory management in long-running processes.
 *
 * @example
 * ```ts
 * clearJsonSchemaCache();
 * ```
 */
export const clearJsonSchemaCache = (): void => {
  jsonSchemaCache.clear();
};

/**
 * Gets the number of cached JSON Schemas.
 *
 * @returns The cache size
 *
 * @example
 * ```ts
 * const size = getJsonSchemaCacheSize();
 * console.log(`Cached schemas: ${size}`);
 * ```
 */
export const getJsonSchemaCacheSize = (): number => {
  return jsonSchemaCache.size;
};
