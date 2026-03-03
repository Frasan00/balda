import { Ajv } from "ajv";
import fastJson, { AnySchema } from "fast-json-stringify";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import type { AjvCompileReturnType } from "./ajv_types.js";
import type {
  FastJsonStringifyFunction,
  SerializerFunction,
} from "./fast_json_stringify_types.js";
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import { ZodLoader } from "../validator/zod_loader.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";

/**
 * Enforces `additionalProperties: false` on all object sub-schemas within
 * a JSON Schema tree. This ensures fast-json-stringify only serializes
 * schema-defined properties — non-schema properties are never sent to the client.
 *
 * Runs once at serializer compile time (cached), so zero runtime overhead.
 * Does not mutate the original schema — returns a structurally shared copy.
 * Skips `$ref` nodes (resolved by fast-json-stringify itself).
 */
export function enforceSchemaStripping(schema: JSONSchema): JSONSchema {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  let result: JSONSchema | undefined;

  if (schema.properties && typeof schema.properties === "object") {
    result = { ...schema, additionalProperties: false };

    const props = schema.properties as Record<string, JSONSchema>;
    const newProps: Record<string, JSONSchema> = {};
    let propsChanged = false;

    for (const key in props) {
      const prop = props[key];
      if (prop && typeof prop === "object" && !("$ref" in prop)) {
        const stripped = enforceSchemaStripping(prop);
        if (stripped !== prop) propsChanged = true;
        newProps[key] = stripped;
      } else {
        newProps[key] = prop;
      }
    }

    if (propsChanged) {
      result.properties = newProps;
    }
  }

  // Handle array items
  if (
    schema.items &&
    typeof schema.items === "object" &&
    !("$ref" in schema.items)
  ) {
    const strippedItems = enforceSchemaStripping(schema.items as JSONSchema);
    if (strippedItems !== schema.items) {
      result = result ?? { ...schema };
      result.items = strippedItems;
    }
  }

  // Handle oneOf / anyOf / allOf
  for (const keyword of ["oneOf", "anyOf", "allOf"] as const) {
    const arr = (schema as any)[keyword];
    if (Array.isArray(arr)) {
      const newArr: JSONSchema[] = [];
      let arrChanged = false;
      for (const sub of arr) {
        if (sub && typeof sub === "object" && !("$ref" in sub)) {
          const stripped = enforceSchemaStripping(sub);
          if (stripped !== sub) arrChanged = true;
          newArr.push(stripped);
        } else {
          newArr.push(sub);
        }
      }
      if (arrChanged) {
        result = result ?? { ...schema };
        (result as any)[keyword] = newArr;
      }
    }
  }

  // Handle $defs / definitions
  for (const defsKey of ["$defs", "definitions"] as const) {
    const defs = (schema as any)[defsKey];
    if (defs && typeof defs === "object") {
      const newDefs: Record<string, JSONSchema> = {};
      let defsChanged = false;
      for (const key in defs) {
        const def = defs[key];
        if (def && typeof def === "object") {
          const stripped = enforceSchemaStripping(def);
          if (stripped !== def) defsChanged = true;
          newDefs[key] = stripped;
        } else {
          newDefs[key] = def;
        }
      }
      if (defsChanged) {
        result = result ?? { ...schema };
        (result as any)[defsKey] = newDefs;
      }
    }
  }

  return result ?? schema;
}

/**
 * Global state for the AJV instance used for JSON Schema validation.
 *
 * ## Custom AJV Instance
 *
 * You can provide your own AJV instance with custom configuration:
 *
 * ```typescript
 * import { Ajv } from 'ajv';
 * import { Server } from 'balda';
 *
 * const customAjv = new Ajv({
 *   validateSchema: false, // Required - must be false and will be ignored if provided
 *   strict: false,         // Required - must be false and will be ignored if provided
 *   allErrors: true,       // Optional - your custom config
 *   // ... other custom options
 * });
 *
 * // Add custom formats, keywords, etc.
 * customAjv.addFormat('custom-format', /regex/);
 *
 * // Pass the custom AJV instance to the server constructor
 * new Server({
 *   ajvInstance: customAjv,
 * });
 * ```
 *
 * **IMPORTANT:** The following options are required and must not be changed:
 * - `validateSchema: false` - Required for proper Zod schema compilation
 * - `strict: false` - Required for proper Zod schema compilation
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
   * WeakMap to cache complete route response serializers.
   * Avoids per-request iteration and type detection.
   */
  private static responseSerializersCache = new WeakMap<
    Record<number, RequestSchema>,
    Map<number, FastJsonStringifyFunction>
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
    jsonSchema: JSONSchema,
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
      const strippedSchema = enforceSchemaStripping(jsonSchema);
      const serializer = fastJson(
        strippedSchema as Parameters<typeof fastJson>[0],
        {
          ajv: this.ajv.opts as any,
        },
      );

      prefixMap.set(prefix, serializer);
      return serializer;
    } catch {
      return null;
    }
  }

  /**
   * Gets or creates serializers for all response schemas.
   */
  static getOrCreateResponseSerializers(
    schemas?: Record<number, RequestSchema>,
  ): Map<number, FastJsonStringifyFunction> | null {
    if (!schemas) {
      return null;
    }

    // Check cache first
    const cached = this.responseSerializersCache.get(schemas);
    if (cached) {
      return cached;
    }

    // Cache miss: resolve all serializers
    const resolved = new Map<number, FastJsonStringifyFunction>();
    for (const [statusCode, schema] of Object.entries(schemas)) {
      const status = Number(statusCode);

      // Determine schema type and get serializer
      let serializer: FastJsonStringifyFunction | null = null;

      if (ZodLoader.isZodSchema(schema)) {
        const jsonSchema = ZodLoader.toJSONSchema(schema);
        serializer = this.getOrCreateSerializer(
          jsonSchema,
          "fast_stringify_zod",
        );
      } else if (TypeBoxLoader.isTypeBoxSchema(schema)) {
        serializer = this.getOrCreateSerializer(
          schema as JSONSchema,
          "fast_stringify_typebox",
        );
      } else if (typeof schema === "object" && schema !== null) {
        serializer = this.getOrCreateSerializer(
          schema as JSONSchema,
          "fast_stringify_json",
        );
      }

      if (serializer) {
        resolved.set(status, serializer);
      }
    }

    // Cache for future requests
    this.responseSerializersCache.set(schemas, resolved);
    return resolved;
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
