import { AjvStateManager } from "../../ajv/ajv.js";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import { getSchemaRefKey } from "../../ajv/schema_ref_cache.js";
import { MetadataStore } from "../../metadata_store.js";
import type { Response } from "../../server/http/response.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";
import type { RequestSchema } from "../validation/validate_types.js";
import type { SerializeOptions } from "./serialize_types.js";

const SERIALIZE_WRAPPED = Symbol("serializeWrapped");
const SERIALIZE_METADATA = Symbol("serializeMetadata");

/**
 * Compiles and caches an AJV validator for a schema.
 * Returns the compiled validator for validation purposes.
 */
const getCompiledValidator = (
  schema: RequestSchema,
): ReturnType<typeof AjvStateManager.ajv.compile> | null => {
  if (ZodLoader.isZodSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "serialize_zod");
    let compiledSchema = openapiSchemaMap.get(refKey);
    if (!compiledSchema) {
      const jsonSchema = schema.toJSONSchema();
      compiledSchema = AjvStateManager.ajv.compile(jsonSchema);
      openapiSchemaMap.set(refKey, compiledSchema);
    }
    return compiledSchema;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "serialize_typebox");
    let compiledSchema = openapiSchemaMap.get(refKey);
    if (!compiledSchema) {
      compiledSchema = AjvStateManager.ajv.compile(schema);
      openapiSchemaMap.set(refKey, compiledSchema);
    }
    return compiledSchema;
  }

  if (typeof schema === "object" && schema !== null) {
    const refKey = getSchemaRefKey(schema, "serialize_json");
    let compiledSchema = openapiSchemaMap.get(refKey);
    if (!compiledSchema) {
      compiledSchema = AjvStateManager.ajv.compile(
        schema as AjvCompileParams[0],
      );
      openapiSchemaMap.set(refKey, compiledSchema);
    }
    return compiledSchema;
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  let compiledSchema = openapiSchemaMap.get(cacheKey);
  if (!compiledSchema) {
    compiledSchema = AjvStateManager.ajv.compile(schema as AjvCompileParams[0]);
    openapiSchemaMap.set(cacheKey, compiledSchema);
  }
  return compiledSchema;
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

    if (!descriptor.value[SERIALIZE_METADATA]) {
      descriptor.value[SERIALIZE_METADATA] = {};
    }

    descriptor.value[SERIALIZE_METADATA][status] = {
      name: propertyKey,
      schema,
      safe: options?.safe ?? true,
    };

    if (!descriptor.value[SERIALIZE_WRAPPED]) {
      const originalMethod = descriptor.value;
      const wrappedFunction = async function (this: any, ...args: any[]) {
        const res = args[1] as Response;
        await originalMethod.apply(this, args);
        const actualStatus = res.responseStatus;

        const serializeMetadata = wrappedFunction[SERIALIZE_METADATA];
        const schema = serializeMetadata?.[actualStatus]?.schema;
        const safe = serializeMetadata?.[actualStatus]?.safe ?? true;

        if (!schema) {
          return;
        }

        const body = res.getBody();

        // When safe mode is disabled, validate the response body against the schema
        if (!safe) {
          try {
            const compiledSchema = getCompiledValidator(schema);
            if (compiledSchema) {
              await validateSchema(compiledSchema, body, safe);
            }
          } catch (error) {
            const zod = await ZodLoader.load();
            if (error instanceof zod.ZodError) {
              res.internalServerError({
                received: body,
                schema,
                error,
              });
              return;
            }

            throw error;
          }
        }

        // Always use fast-json-stringify when a schema is provided
        // This applies to both safe and unsafe modes
        res.json(body, schema);
      };

      wrappedFunction[SERIALIZE_WRAPPED] = true;
      wrappedFunction[SERIALIZE_METADATA] = originalMethod[SERIALIZE_METADATA];
      descriptor.value = wrappedFunction;
    }
  };
};
