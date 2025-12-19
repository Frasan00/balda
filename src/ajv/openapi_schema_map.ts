import type { AjvCompileReturnType } from "./ajv_types.js";

/**
 * Maps globally the controller schemas to the compiled AJV schemas in order to cache them.
 * Uses Symbol (for object schema references) or string (for primitive schemas) as cache keys.
 */
export const openapiSchemaMap = new Map<
  symbol | string,
  AjvCompileReturnType
>();
