import { compileAndCacheValidator } from "../../ajv/schema_compiler.js";
import { getOrCreateSerializer } from "../../ajv/fast_json_stringify_cache.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import { getSchemaRefKey } from "../../ajv/schema_ref_cache.js";
import { MetadataStore } from "../../metadata_store.js";
import type { Response } from "../../server/http/response.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";
import type { RequestSchema } from "../validation/validate_types.js";
import type { SerializeOptions } from "./serialize_types.js";

/**
 * Metadata entry for serialize decorator
 */
interface SerializeMetadataEntry {
  name: string;
  schema: RequestSchema;
  safe: boolean;
}

/**
 * WeakMap to store serialize metadata without mutating function objects.
 * This prevents issues with strict mode and frozen objects.
 */
const SERIALIZE_METADATA_MAP = new WeakMap<
  Function,
  Record<number, SerializeMetadataEntry>
>();

/**
 * WeakSet to track which functions have been wrapped.
 */
const SERIALIZE_WRAPPED_SET = new WeakSet<Function>();

/**
 * Gets the compiled validator for a schema from the cache.
 * The schema must already be compiled via compileAndCacheValidator.
 * @param schema - The schema to get the validator for
 * @returns The compiled validator, or null if not found
 */
const getCompiledValidator = (
  schema: RequestSchema,
): ReturnType<typeof openapiSchemaMap.get> => {
  if (ZodLoader.isZodSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "serialize_zod");
    return openapiSchemaMap.get(refKey);
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "serialize_typebox");
    return openapiSchemaMap.get(refKey);
  }

  if (typeof schema === "object" && schema !== null) {
    const refKey = getSchemaRefKey(schema, "serialize_json");
    return openapiSchemaMap.get(refKey);
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  return openapiSchemaMap.get(cacheKey);
};

export const serialize = <T extends RequestSchema>(
  schema: T,
  options?: SerializeOptions,
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey) || {
      middlewares: [],
      route: {},
    };
    if (!meta.documentation) {
      meta.documentation = {};
    }
    if (!meta.documentation.responses) {
      meta.documentation.responses = {};
    }
    if (!meta.serializeOptions) {
      meta.serializeOptions = {};
    }

    const status = Number(options?.status ?? 200);
    meta.documentation.responses[status] = schema;
    meta.serializeOptions[status] = options?.safe ?? true;
    MetadataStore.set(target, propertyKey, meta);

    compileAndCacheValidator(schema);
    getOrCreateSerializer(schema);

    // Store metadata in WeakMap instead of mutating function
    const existingMetadata = SERIALIZE_METADATA_MAP.get(descriptor.value) || {};
    existingMetadata[status] = {
      name: propertyKey,
      schema,
      safe: options?.safe ?? true,
    };
    SERIALIZE_METADATA_MAP.set(descriptor.value, existingMetadata);

    if (!SERIALIZE_WRAPPED_SET.has(descriptor.value)) {
      const originalMethod = descriptor.value;
      const wrappedFunction = async function (this: any, ...args: any[]) {
        const res = args[1] as Response;
        await originalMethod.apply(this, args);
        const actualStatus = res.responseStatus;

        const serializeMetadata = SERIALIZE_METADATA_MAP.get(wrappedFunction);
        const schema = serializeMetadata?.[actualStatus]?.schema;
        const safe = serializeMetadata?.[actualStatus]?.safe ?? true;

        if (!schema) {
          return;
        }

        const body = res.getBody();

        // When safe mode is disabled, validate the response body against the schema
        if (!safe) {
          const compiledSchema = getCompiledValidator(schema);
          if (compiledSchema) {
            await validateSchema(compiledSchema, body, safe);
          }
        }

        res.json(body, schema);
      };

      // Mark as wrapped and copy metadata to wrapped function
      SERIALIZE_WRAPPED_SET.add(wrappedFunction);
      const originalMetadata = SERIALIZE_METADATA_MAP.get(originalMethod);
      if (originalMetadata) {
        SERIALIZE_METADATA_MAP.set(wrappedFunction, originalMetadata);
      }
      descriptor.value = wrappedFunction;
    }
  };
};
