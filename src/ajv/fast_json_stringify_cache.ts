import fastJson, { AnySchema } from "fast-json-stringify";
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { ZodLoader } from "../validator/zod_loader.js";
import type { AjvCompileParams } from "./ajv_types.js";
import type {
  SerializerCacheEntry,
  SerializerFunction,
} from "./fast_json_stringify_types.js";
import {
  getSchemaRefCount,
  getSchemaRefKey,
  resetSchemaRefCache,
} from "./schema_ref_cache.js";

/**
 * Maps globally the controller schemas to the compiled fast-json-stringify serializers.
 * Uses Symbol (for object schema references) or string (for primitive schemas) as cache keys.
 *
 * This is a parallel cache to openapiSchemaMap, specifically for fast JSON serialization.
 * While openapiSchemaMap caches AJV validators (for validation), this map caches
 * fast-json-stringify functions (for serialization).
 *
 * Supports caching for:
 * - Zod schemas (compiled once from Zod to JSON Schema to fast-json-stringify)
 * - TypeBox schemas (compiled once directly to fast-json-stringify, as they're already JSON Schema)
 * - Plain JSON schemas (compiled once directly to fast-json-stringify)
 */
export const fastJsonStringifyMap = new Map<
  symbol | string,
  SerializerCacheEntry
>();

/**
 * Gets or creates a cached fast-json-stringify serializer for the given schema.
 *
 * @param schema - The schema to compile (Zod, TypeBox, or plain JSON schema). If null/undefined, returns null.
 * @returns A compiled serializer function, or null if no schema was provided
 *
 * @example
 * ```ts
 * const serializer = getOrCreateSerializer(zodSchema);
 * if (serializer) {
 *   const jsonString = serializer(data);
 * } else {
 *   const jsonString = JSON.stringify(data);
 * }
 * ```
 */
export const getOrCreateSerializer = (
  schema: RequestSchema | undefined,
): SerializerFunction => {
  if (!schema) {
    return null;
  }

  const { jsonSchema, cacheKey } = getJsonSchemaAndCacheKey(schema);

  const cached = fastJsonStringifyMap.get(cacheKey);
  if (cached) {
    return cached.serializer;
  }

  try {
    const serializer = fastJson(jsonSchema as AnySchema);

    const cacheEntry: SerializerCacheEntry = {
      serializer,
      schema: jsonSchema,
      compiledAt: Date.now(),
    };
    fastJsonStringifyMap.set(cacheKey, cacheEntry);

    return serializer;
  } catch (error) {
    console.error(
      "Failed to compile fast-json-stringify serializer:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
};

/**
 * Extracts the JSON Schema from a schema (Zod, TypeBox, or plain JSON)
 * and generates a cache key using the unified schema reference cache.
 *
 * @param schema - The schema to process
 * @returns An object with the JSON Schema and cache key
 */
const getJsonSchemaAndCacheKey = (
  schema: RequestSchema,
): {
  jsonSchema: AjvCompileParams[0];
  cacheKey: symbol | string;
} => {
  if (ZodLoader.isZodSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "fast_stringify_zod");
    const jsonSchema = ZodLoader.toJSONSchema(schema);
    return { jsonSchema, cacheKey: refKey };
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "fast_stringify_typebox");
    return { jsonSchema: schema, cacheKey: refKey };
  }

  if (typeof schema === "object" && schema !== null) {
    const refKey = getSchemaRefKey(schema, "fast_stringify_json");
    return { jsonSchema: schema as AjvCompileParams[0], cacheKey: refKey };
  }

  const cacheKey = JSON.stringify(schema);
  return { jsonSchema: schema as AjvCompileParams[0], cacheKey };
};

/**
 * Clears the fast-json-stringify serializer cache.
 * Also resets the shared schema reference cache.
 * Useful for testing or memory management in long-running processes.
 *
 * @example
 * ```ts
 * clearSerializerCache();
 * ```
 */
export const clearSerializerCache = (): void => {
  fastJsonStringifyMap.clear();
  resetSchemaRefCache();
};

/**
 * Gets statistics about the serializer cache.
 * Useful for monitoring and debugging.
 *
 * @returns An object with cache statistics including:
 *   - size: Number of cached serializers
 *   - schemaRefsCreated: Total number of unique schema references created (cumulative)
 *   - entries: Details about each cached serializer
 *
 * @example
 * ```ts
 * const stats = getSerializerCacheStats();
 * console.log(`Cached serializers: ${stats.size}`);
 * console.log(`Schema refs created: ${stats.schemaRefsCreated}`);
 * ```
 */
export const getSerializerCacheStats = (): {
  size: number;
  schemaRefsCreated: number;
  entries: Array<{
    key: string;
    compiledAt: number;
    schemaType: string;
  }>;
} => {
  const entries = Array.from(fastJsonStringifyMap.entries()).map(
    ([key, value]) => ({
      key: typeof key === "symbol" ? key.description || "symbol" : key,
      compiledAt: value.compiledAt,
      schemaType: getSchemaTypeDescription(value.schema),
    }),
  );

  return {
    size: fastJsonStringifyMap.size,
    schemaRefsCreated: getSchemaRefCount(),
    entries,
  };
};

/**
 * Helper function to get a description of the schema type.
 */
const getSchemaTypeDescription = (schema: AjvCompileParams[0]): string => {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if ("type" in schema) {
    return `schema:${schema.type}`;
  }

  if ("$ref" in schema) {
    return "schema:$ref";
  }

  return "schema:object";
};
