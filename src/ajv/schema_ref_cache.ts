/**
 * Unified schema reference cache for generating stable cache keys from schema objects.
 *
 * ## Purpose
 *
 * This module provides a single WeakMap-based cache used across all schema compilation systems:
 * - Request validation (AJV validators)
 * - Response serialization (fast-json-stringify)
 * - JSON Schema conversion (for Swagger/OpenAPI)
 *
 * ## Cache Key Strategy
 *
 * The framework uses **different cache key prefixes** for the same schema object depending on context:
 *
 * ### Request Validation Keys
 * - `zod_schema` - Zod schemas for request validation
 * - `typebox_schema` - TypeBox schemas for request validation
 * - `json_schema` - Plain JSON schemas for request validation
 *
 * ### Response Serialization Keys
 * - `fast_stringify_zod` - Zod schemas for fast JSON serialization
 * - `fast_stringify_typebox` - TypeBox schemas for fast JSON serialization
 * - `fast_stringify_json` - Plain JSON schemas for fast JSON serialization
 *
 * ### Serialize Decorator Keys
 * - `serialize_zod` - Zod schemas used in @serialize decorator
 * - `serialize_typebox` - TypeBox schemas used in @serialize decorator
 * - `serialize_json` - Plain JSON schemas used in @serialize decorator
 *
 * ### JSON Schema Cache Keys
 * - `json_schema_zod` - Converted Zod to JSON Schema
 * - `json_schema_typebox` - Converted TypeBox to JSON Schema
 * - `json_schema_json` - Plain JSON schemas
 *
 * ## Why Different Prefixes?
 *
 * Different prefixes for the same schema serve important purposes:
 *
 * 1. **Separation of Concerns**: Validation and serialization have different requirements.
 *    A schema compiled for validation may have different options than one compiled
 *    for serialization.
 *
 * 2. **Independent Caching**: Allows one cache to be cleared without affecting others.
 *    For example, clearing serializer cache doesn't invalidate validators.
 *
 * 3. **Different Compilation Targets**: The same schema may need different compiled
 *    artifacts (AJV validator vs fast-json-stringify function vs OpenAPI JSON).
 *
 * 4. **Debug and Monitoring**: Different prefixes make it easier to track which
 *    cache a specific compilation belongs to when debugging.
 *
 * ## Memory Efficiency
 *
 * - Uses WeakMap to track schema objects by reference
 * - Allows garbage collection when schemas are no longer referenced
 * - Symbol-based keys prevent collisions and counter overflow
 * - Same schema object reuses the same Symbol within a prefix
 */

/**
 * WeakMap to cache schema objects by reference with nested prefix tracking.
 * Maps schema objects to a Map of prefixes to Symbols.
 * This ensures the same schema object gets different Symbols for different contexts.
 * Uses Symbol for unique cache keys to prevent any potential counter overflow in long-running servers.
 * This cache is used for Zod, TypeBox, and plain JSON schemas.
 */
let schemaRefCache = new WeakMap<object, Map<string, symbol>>();

/**
 * Counter for tracking total number of schema references created.
 * Useful for debugging and monitoring cache behavior.
 */
let refCounter = 0;

/**
 * Gets or creates a stable Symbol key for a schema object with a specific prefix.
 * If the schema has been seen before with the same prefix, returns the existing Symbol.
 * Otherwise, creates a new Symbol and caches it.
 *
 * The same schema object with different prefixes will get different Symbols,
 * allowing proper cache separation between validation, serialization, and documentation.
 *
 * @param schema - The schema object to get a key for
 * @param prefix - Prefix for the Symbol description (defaults to "schema_ref")
 * @returns A Symbol that uniquely identifies this schema object + prefix combination
 *
 * @example
 * ```ts
 * const schema = { type: 'object' };
 * const key1 = getSchemaRefKey(schema, "zod_schema");
 * const key2 = getSchemaRefKey(schema, "fast_stringify_zod");
 * console.log(key1 === key2); // false - different prefixes, different Symbols
 * const key3 = getSchemaRefKey(schema, "zod_schema");
 * console.log(key1 === key3); // true - same schema + prefix returns same Symbol
 * ```
 */
export const getSchemaRefKey = (
  schema: object,
  prefix: string = "schema_ref",
): symbol => {
  let prefixMap = schemaRefCache.get(schema);
  if (!prefixMap) {
    prefixMap = new Map<string, symbol>();
    schemaRefCache.set(schema, prefixMap);
  }

  let refKey = prefixMap.get(prefix);
  if (!refKey) {
    refKey = Symbol(`${prefix}_${++refCounter}`);
    prefixMap.set(prefix, refKey);
  }
  return refKey;
};

/**
 * Gets the total number of unique schema references that have been created.
 * This count only increases, never decreases (even when schemas are garbage collected).
 *
 * @returns The total number of schema references created since startup or last reset
 *
 * @example
 * ```ts
 * const stats = getSchemaRefCount();
 * console.log(`Total schemas cached: ${stats}`);
 * ```
 */
export const getSchemaRefCount = (): number => {
  return refCounter;
};

/**
 * Resets the schema reference cache.
 * This is primarily useful for testing to ensure clean state between tests.
 *
 * @internal
 */
export const resetSchemaRefCache = (): void => {
  schemaRefCache = new WeakMap<object, Map<string, symbol>>();
  refCounter = 0;
};
