import type { AjvCompileReturnType } from "./ajv_types.js";

/**
 * Maps globally the controller schemas to the compiled AJV schemas in order to cache them.
 * Uses Symbol (for object schema references) or string (for primitive schemas) as cache keys.
 *
 * Supports caching for:
 * - Zod schemas (compiled once from Zod to JSON Schema to AJV)
 * - TypeBox schemas (compiled once directly to AJV, as they're already JSON Schema)
 * - Plain JSON schemas (compiled once directly to AJV)
 *
 * Schema objects are tracked in a WeakMap to generate stable cache keys,
 * preventing redundant compilation across the application lifecycle.
 */
export const openapiSchemaMap = new Map<
  symbol | string,
  AjvCompileReturnType
>();
