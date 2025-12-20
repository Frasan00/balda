import type { TSchema } from "@sinclair/typebox";
import type { ZodType } from "zod";
import { AjvStateManager } from "../../ajv/ajv.js";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import { MetadataStore } from "../../metadata_store.js";
import type { Response } from "../../server/http/response.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";
import type { SerializeOptions } from "./serialize_types.js";

const SERIALIZE_WRAPPED = Symbol("serializeWrapped");
const SERIALIZE_METADATA = Symbol("serializeMetadata");

/**
 * WeakMap to cache schema objects by reference in serialize decorator.
 * Uses Symbol for unique cache keys to prevent any potential counter overflow in long-running servers.
 * This cache is used for Zod, TypeBox, and plain JSON schemas.
 */
const serializeSchemaRefCache = new WeakMap<object, symbol>();

export const serialize = <T extends ZodType | TSchema | AjvCompileParams[0]>(
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

        if (schema && !safe) {
          const body = res.getBody();
          try {
            let cacheKey: string;

            // Use WeakMap cache for schema object references
            if (ZodLoader.isZodSchema(schema)) {
              let refKey = serializeSchemaRefCache.get(schema);
              if (!refKey) {
                refKey = Symbol("serialize_zod_schema");
                serializeSchemaRefCache.set(schema, refKey);
              }

              let compiledSchema = openapiSchemaMap.get(refKey);
              if (!compiledSchema) {
                const jsonSchema = schema.toJSONSchema();
                compiledSchema = AjvStateManager.ajv.compile(jsonSchema);
                openapiSchemaMap.set(refKey, compiledSchema);
              }

              await validateSchema(compiledSchema, body, safe);
              res.send(body);
            } else if (TypeBoxLoader.isTypeBoxSchema(schema)) {
              // TypeBox schema - already JSON Schema compliant
              let refKey = serializeSchemaRefCache.get(schema);
              if (!refKey) {
                refKey = Symbol("serialize_typebox_schema");
                serializeSchemaRefCache.set(schema, refKey);
              }

              let compiledSchema = openapiSchemaMap.get(refKey);
              if (!compiledSchema) {
                compiledSchema = AjvStateManager.ajv.compile(schema);
                openapiSchemaMap.set(refKey, compiledSchema);
              }

              await validateSchema(compiledSchema, body, safe);
              res.send(body);
            } else if (typeof schema === "object" && schema !== null) {
              // Plain JSON schema object
              let refKey = serializeSchemaRefCache.get(schema);
              if (!refKey) {
                refKey = Symbol("serialize_json_schema");
                serializeSchemaRefCache.set(schema, refKey);
              }

              let compiledSchema = openapiSchemaMap.get(refKey);
              if (!compiledSchema) {
                compiledSchema = AjvStateManager.ajv.compile(
                  schema as AjvCompileParams[0],
                );
                openapiSchemaMap.set(refKey, compiledSchema);
              }

              await validateSchema(compiledSchema, body, safe);
              res.send(body);
            } else {
              // Fallback to JSON.stringify for primitives or edge cases
              cacheKey = JSON.stringify(schema);
              let compiledSchema = openapiSchemaMap.get(cacheKey);
              if (!compiledSchema) {
                compiledSchema = AjvStateManager.ajv.compile(
                  schema as AjvCompileParams[0],
                );
                openapiSchemaMap.set(cacheKey, compiledSchema);
              }

              await validateSchema(compiledSchema, body, safe);
              res.send(body);
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
      };

      wrappedFunction[SERIALIZE_WRAPPED] = true;
      wrappedFunction[SERIALIZE_METADATA] = originalMethod[SERIALIZE_METADATA];
      descriptor.value = wrappedFunction;
    }
  };
};
