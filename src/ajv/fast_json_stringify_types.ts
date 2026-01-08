import type { AjvCompileParams } from "./ajv_types.js";

/**
 * A fast JSON stringify function compiled from a schema.
 * This function serializes data to JSON much faster than JSON.stringify()
 * when the data structure is known in advance.
 */
export type FastJsonStringifyFunction = (data: any) => string;

/**
 * The serializer function that can be either a compiled fast-json-stringify
 * or null if no schema was provided (fallback to standard JSON.stringify).
 */
export type SerializerFunction = FastJsonStringifyFunction | null;

/**
 * Options for creating a fast JSON stringifier.
 */
export interface FastJsonStringifyOptions {
  /**
   * The JSON Schema to use for compilation.
   * Can be from Zod (after toJSONSchema()), TypeBox, or plain JSON schema.
   */
  schema: AjvCompileParams[0];
}

/**
 * Extended cache value type that includes both the serializer function
 * and optional metadata.
 */
export interface SerializerCacheEntry {
  /**
   * The compiled fast-json-stringify function.
   */
  serializer: FastJsonStringifyFunction;
  /**
   * The original schema for reference/debugging.
   */
  schema: AjvCompileParams[0];
  /**
   * Timestamp when this serializer was compiled.
   */
  compiledAt: number;
}
