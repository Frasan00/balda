/**
 * Unified schema reference cache for generating stable cache keys from schema objects.
 * This module provides a single WeakMap-based cache used by both:
 * - The serialize decorator (for AJV validation caching)
 * - The fast-json-stringify cache (for serializer caching)
 *
 * Using a unified cache ensures that the same schema object gets the same
 * Symbol key across both systems, improving efficiency and consistency.
 */

/**
 * WeakMap to cache schema objects by reference.
 * Uses Symbol for unique cache keys to prevent any potential counter overflow in long-running servers.
 * This cache is used for Zod, TypeBox, and plain JSON schemas.
 */
let schemaRefCache = new WeakMap<object, symbol>();

/**
 * Counter for tracking total number of schema references created.
 * Useful for debugging and monitoring cache behavior.
 */
let refCounter = 0;

/**
 * Gets or creates a stable Symbol key for a schema object.
 * If the schema has been seen before, returns the existing Symbol.
 * Otherwise, creates a new Symbol and caches it.
 *
 * @param schema - The schema object to get a key for
 * @param prefix - Optional prefix for the Symbol description (defaults to "schema_ref")
 * @returns A Symbol that uniquely identifies this schema object
 *
 * @example
 * ```ts
 * const key1 = getSchemaRefKey(mySchema);
 * const key2 = getSchemaRefKey(mySchema);
 * console.log(key1 === key2); // true - same schema returns same key
 * ```
 */
export const getSchemaRefKey = (
  schema: object,
  prefix: string = "schema_ref",
): symbol => {
  let refKey = schemaRefCache.get(schema);
  if (!refKey) {
    refKey = Symbol(`${prefix}_${++refCounter}`);
    schemaRefCache.set(schema, refKey);
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
  schemaRefCache = new WeakMap<object, symbol>();
  refCounter = 0;
};
