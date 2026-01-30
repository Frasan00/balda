import { Ajv } from "ajv";
import fastJson, { AnySchema } from "fast-json-stringify";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import type { AjvCompileReturnType } from "./ajv_types.js";
import type {
  FastJsonStringifyFunction,
  SerializerFunction,
} from "./fast_json_stringify_types.js";

/**
 * Global state for the AJV instance used for JSON Schema validation.
 *
 * ## Custom AJV Instance
 *
 * You can provide your own AJV instance with custom configuration:
 *
 * ```typescript
 * import { Ajv } from 'ajv';
 * import { AjvStateManager } from 'balda';
 *
 * const customAjv = new Ajv({
 *   validateSchema: false, // Required - must be false
 *   strict: false,         // Required - must be false
 *   allErrors: true,       // Optional - your custom config
 *   // ... other custom options
 * });
 *
 * // Add custom formats, keywords, etc.
 * customAjv.addFormat('custom-format', /regex/);
 *
 * // Set as global instance
 * AjvStateManager.setGlobalInstance(customAjv);
 * ```
 *
 * **IMPORTANT:** The following options are required and must not be changed:
 * - `validateSchema: false` - Required for proper Zod schema compilation
 * - `strict: false` - Required for proper Zod schema compilation
 *
 * Changing these values will cause validation errors and break Zod schema support.
 */
export class AjvStateManager {
  static ajv: Ajv = new Ajv({
    validateSchema: false, // Required - do not change
    strict: false, // Required - do not change
  });

  /**
   * WeakMap to store fast-json-stringify serializers.
   * Keyed by schema object reference for automatic garbage collection.
   */
  private static serializerCache = new WeakMap<
    object,
    Map<string, FastJsonStringifyFunction>
  >();

  /**
   * Counter for generating unique symbol-based keys.
   */
  private static refCounter = 0;

  /**
   * WeakMap to track schema objects and their generated keys.
   * Prevents duplicate key generation for the same schema object.
   */
  private static schemaKeyCache = new WeakMap<object, Map<string, string>>();

  static {
    this.ajv.addFormat(
      "email",
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    );

    this.ajv.addFormat(
      "url",
      /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
    );

    this.ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);

    this.ajv.addFormat(
      "datetime",
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
    );

    this.ajv.addFormat("time", /^\d{2}:\d{2}:\d{2}$/);
    this.ajv.addFormat("binary", /^(?:[0-9a-fA-F]{2})+$/);
    this.ajv.addFormat(
      "base64",
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    );
    this.ajv.addFormat(
      "uuid",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }

  /**
   * Sets the global AJV instance to use for JSON Schema validation.
   * @param ajv - The AJV instance to set as global.
   * @warning The AJV instance must be configured with the following options:
   * - `validateSchema: false` - Required for proper Zod schema compilation
   * - `strict: false` - Required for proper Zod schema compilation
   * Changing these values will cause validation errors and break Zod schema support.
   */
  static setGlobalInstance(ajv: Ajv) {
    this.ajv = ajv;
    this.ajv.opts.strict = false;
    this.ajv.opts.validateSchema = false;
  }

  /**
   * Generates a stable key for a schema object with a specific prefix.
   * Same schema + prefix combination always returns the same key.
   *
   * @param schema - The schema object
   * @param prefix - Context prefix (e.g., "validator", "serializer", "json_schema")
   * @returns A string key for use with Ajv
   */
  private static getSchemaKey(schema: object, prefix: string): string {
    let prefixMap = this.schemaKeyCache.get(schema);
    if (!prefixMap) {
      prefixMap = new Map<string, string>();
      this.schemaKeyCache.set(schema, prefixMap);
    }

    let key = prefixMap.get(prefix);
    if (!key) {
      key = `${prefix}_${++this.refCounter}`;
      prefixMap.set(prefix, key);
    }
    return key;
  }

  /**
   * Gets or compiles a validator from a JSON schema.
   * Uses Ajv's internal caching via addSchema/getSchema.
   *
   * @param jsonSchema - The JSON Schema to compile
   * @param prefix - Context prefix for cache key generation
   * @returns Compiled Ajv validator function
   */
  static getOrCompileValidator(
    jsonSchema: JSONSchema,
    prefix: string,
  ): AjvCompileReturnType {
    const key = this.getSchemaKey(jsonSchema, prefix);

    const cached = this.ajv.getSchema(key);
    if (cached) {
      return cached;
    }

    this.ajv.addSchema(jsonSchema, key);
    const compiled = this.ajv.getSchema(key);
    if (!compiled) {
      throw new Error(`Failed to compile schema with key: ${key}`);
    }
    return compiled;
  }

  /**
   * Gets or creates a fast-json-stringify serializer for a schema.
   * Uses WeakMap for caching to allow garbage collection.
   *
   * @param jsonSchema - The JSON Schema to compile
   * @param prefix - Context prefix for cache key generation
   * @returns Compiled serializer function or null
   */
  static getOrCreateSerializer(
    jsonSchema: JSONSchema | undefined,
    prefix: string,
  ): SerializerFunction {
    if (!jsonSchema || typeof jsonSchema !== "object") {
      return null;
    }

    let prefixMap = this.serializerCache.get(jsonSchema);
    if (!prefixMap) {
      prefixMap = new Map<string, FastJsonStringifyFunction>();
      this.serializerCache.set(jsonSchema, prefixMap);
    }

    const cached = prefixMap.get(prefix);
    if (cached) {
      return cached;
    }

    try {
      const serializer = fastJson(jsonSchema as AnySchema);
      prefixMap.set(prefix, serializer);
      return serializer;
    } catch {
      return null;
    }
  }

  /**
   * Stores a JSON schema in Ajv for later retrieval.
   * Used primarily for Swagger documentation.
   *
   * @param jsonSchema - The JSON Schema to store
   * @param prefix - Context prefix for cache key generation
   */
  static storeJsonSchema(jsonSchema: JSONSchema, prefix: string): void {
    const key = this.getSchemaKey(jsonSchema, prefix);
    if (!this.ajv.getSchema(key)) {
      this.ajv.addSchema(jsonSchema, key);
    }
  }

  /**
   * Retrieves a stored JSON schema from Ajv.
   *
   * @param schemaObject - The original schema object used as reference
   * @param prefix - Context prefix used when storing
   * @returns The JSON schema if found, undefined otherwise
   */
  static getJsonSchema(
    schemaObject: object,
    prefix: string,
  ): JSONSchema | undefined {
    const prefixMap = this.schemaKeyCache.get(schemaObject);
    if (!prefixMap) {
      return undefined;
    }

    const key = prefixMap.get(prefix);
    if (!key) {
      return undefined;
    }

    const schema = this.ajv.getSchema(key);
    return schema?.schema as JSONSchema | undefined;
  }

  /**
   * Clears all cached schemas and serializers.
   * Useful for testing or memory management.
   */
  static clearAllCaches(): void {
    this.ajv = new Ajv({
      validateSchema: false,
      strict: false,
    });
    this.serializerCache = new WeakMap<
      object,
      Map<string, FastJsonStringifyFunction>
    >();
    this.schemaKeyCache = new WeakMap<object, Map<string, string>>();
    this.refCounter = 0;
  }

  /**
   * Gets the total number of schemas stored in Ajv.
   * @returns Count of stored schemas
   */
  static getSchemaCount(): number {
    return Object.keys(this.ajv.schemas).length;
  }

  /**
   * Gets statistics about the schema cache.
   * @returns Cache statistics including schema count
   */
  static getCacheStats(): {
    schemaCount: number;
    totalRefsCreated: number;
  } {
    return {
      schemaCount: this.getSchemaCount(),
      totalRefsCreated: this.refCounter,
    };
  }
}
