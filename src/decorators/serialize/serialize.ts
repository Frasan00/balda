import { compileAndCacheValidator } from "../../ajv/schema_compiler.js";
import { AjvStateManager } from "../../ajv/ajv.js";
import { logger } from "../../logger/logger.js";
import { MetadataStore } from "../../metadata_store.js";
import type { Response } from "../../server/http/response.js";
import type { JSONSchema } from "../../plugins/swagger/swagger_types.js";
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
  throwErrorOnValidationFail: boolean;
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
 * Gets the compiled validator for a schema using Ajv's cache.
 * The schema must already be compiled via compileAndCacheValidator.
 * @param schema - The schema to get the validator for
 * @returns The compiled validator, or null if not found
 */
const getCompiledValidator = (schema: RequestSchema) => {
  const { jsonSchema, prefix } = getJsonSchemaWithPrefix(schema);
  try {
    return AjvStateManager.getOrCompileValidator(jsonSchema, prefix);
  } catch {
    return null;
  }
};

/**
 * Converts any schema type to JSON Schema format with appropriate prefix.
 * @param schema - The schema to convert
 * @returns Object with JSON Schema and prefix
 */
const getJsonSchemaWithPrefix = (
  schema: RequestSchema,
): {
  jsonSchema: JSONSchema;
  prefix: string;
} => {
  if (ZodLoader.isZodSchema(schema)) {
    return {
      jsonSchema: ZodLoader.toJSONSchema(schema),
      prefix: "serialize_zod",
    };
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    return {
      jsonSchema: schema as JSONSchema,
      prefix: "serialize_typebox",
    };
  }

  if (typeof schema === "object" && schema !== null) {
    return {
      jsonSchema: schema as JSONSchema,
      prefix: "serialize_json",
    };
  }

  return {
    jsonSchema: { type: typeof schema } as JSONSchema,
    prefix: `serialize_primitive_${JSON.stringify(schema)}`,
  };
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
    meta.serializeOptions[status] =
      options?.throwErrorOnValidationFail ?? false;
    MetadataStore.set(target, propertyKey, meta);

    // Pre-compile validator and serializer
    compileAndCacheValidator(schema);
    const { jsonSchema, prefix } = getJsonSchemaWithPrefix(schema);
    AjvStateManager.getOrCreateSerializer(jsonSchema, prefix);

    // Store metadata in WeakMap instead of mutating function
    const existingMetadata = SERIALIZE_METADATA_MAP.get(descriptor.value) || {};
    existingMetadata[status] = {
      name: propertyKey,
      schema,
      throwErrorOnValidationFail: options?.throwErrorOnValidationFail ?? false,
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
        const throwErrorOnValidationFail =
          serializeMetadata?.[actualStatus]?.throwErrorOnValidationFail ??
          false;

        if (!schema) {
          return;
        }

        const body = res.getBody();

        // When throwErrorOnValidationFail is enabled, validate the response body against the schema
        if (throwErrorOnValidationFail) {
          const compiledSchema = getCompiledValidator(schema);
          if (compiledSchema) {
            try {
              await validateSchema(
                compiledSchema,
                body,
                throwErrorOnValidationFail,
              );
            } catch (validationError) {
              // Response validation failed - this is a server error (500)
              logger.error(
                {
                  error: validationError,
                  body,
                  statusCode: actualStatus,
                  schemaDescription:
                    typeof schema === "object" && schema !== null
                      ? Object.keys(schema).slice(0, 5).join(", ")
                      : "unknown",
                },
                "Response validation failed in @serialize decorator",
              );
              return res.status(500).json({
                error: "Internal Server Error",
                message: "Response validation failed",
              });
            }
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
