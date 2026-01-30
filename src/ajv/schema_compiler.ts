import { AjvStateManager } from "./ajv.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { ZodLoader } from "../validator/zod_loader.js";
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import type { RouteResponseSchemas } from "../server/router/router_type.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import { logger } from "../logger/logger.js";

/**
 * Compiles and caches a schema validator using Ajv's internal storage.
 * Handles Zod, TypeBox, and plain JSON schemas.
 * Also caches the JSON Schema (OpenAPI format) and fast-json-stringify serializer.
 *
 * This is the single source of truth for schema compilation used by:
 * - Inline routes (server.get() with swagger.responses)
 * - Decorator routes (@serialize decorator)
 *
 * @param schema - The schema to compile (Zod, TypeBox, or plain JSON schema)
 */
export const compileAndCacheValidator = (schema: RequestSchema): void => {
  if (ZodLoader.isZodSchema(schema)) {
    try {
      const jsonSchema = ZodLoader.toJSONSchema(schema);
      AjvStateManager.storeJsonSchema(jsonSchema, "serialize_zod");
      AjvStateManager.getOrCompileValidator(jsonSchema, "serialize_zod");
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "zod",
          context: "serialize_decorator",
        },
        "Failed to compile Zod schema for validation. Schema may contain unsupported types (e.g., z.instanceof). Runtime validation will still work, but Swagger documentation may be incomplete.",
      );
      return;
    }
    return;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    try {
      AjvStateManager.storeJsonSchema(
        schema as JSONSchema,
        "serialize_typebox",
      );
      AjvStateManager.getOrCompileValidator(
        schema as JSONSchema,
        "serialize_typebox",
      );
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "typebox",
          context: "serialize_decorator",
        },
        "Failed to compile TypeBox schema for validation. Schema may be invalid or use unsupported features.",
      );
      return;
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    try {
      AjvStateManager.storeJsonSchema(schema as JSONSchema, "serialize_json");
      AjvStateManager.getOrCompileValidator(
        schema as JSONSchema,
        "serialize_json",
      );
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "json",
          context: "serialize_decorator",
        },
        "Failed to compile JSON schema for validation. Schema may be invalid or malformed.",
      );
      return;
    }
    return;
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  try {
    const primitiveSchema = { type: typeof schema };
    AjvStateManager.storeJsonSchema(
      primitiveSchema as JSONSchema,
      `serialize_primitive_${cacheKey}`,
    );
    AjvStateManager.getOrCompileValidator(
      primitiveSchema as JSONSchema,
      `serialize_primitive_${cacheKey}`,
    );
  } catch (error) {
    logger.warn(
      {
        error,
        schemaType: "primitive",
        cacheKey,
        context: "serialize_decorator",
      },
      "Failed to compile schema for validation. Schema format may be unsupported.",
    );
  }
};

/**
 * Compiles and caches a request schema validator using runtime validation cache keys.
 * Uses the same cache keys as Request.validate() for consistency.
 * Does NOT compile serializers (those are for output only).
 * Also caches the JSON Schema (OpenAPI format) for Swagger documentation.
 *
 * @param schema - The schema to compile (Zod, TypeBox, or plain JSON schema)
 */
export const compileRequestValidator = (schema: RequestSchema): void => {
  if (ZodLoader.isZodSchema(schema)) {
    try {
      const jsonSchema = ZodLoader.toJSONSchema(schema);
      AjvStateManager.storeJsonSchema(jsonSchema, "zod_schema");
      AjvStateManager.getOrCompileValidator(jsonSchema, "zod_schema");
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "zod",
          context: "request_validation",
        },
        "Failed to compile Zod schema for request validation. Schema may contain unsupported types (e.g., z.instanceof). Swagger documentation may be incomplete.",
      );
      return;
    }
    return;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    try {
      AjvStateManager.storeJsonSchema(schema as JSONSchema, "typebox_schema");
      AjvStateManager.getOrCompileValidator(
        schema as JSONSchema,
        "typebox_schema",
      );
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "typebox",
          context: "request_validation",
        },
        "Failed to compile TypeBox schema for request validation. Schema may be invalid or use unsupported features.",
      );
      return;
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    try {
      AjvStateManager.storeJsonSchema(schema as JSONSchema, "json_schema");
      AjvStateManager.getOrCompileValidator(
        schema as JSONSchema,
        "json_schema",
      );
    } catch (error) {
      logger.warn(
        {
          error,
          schemaType: "json",
          context: "request_validation",
        },
        "Failed to compile JSON schema for request validation. Schema may be invalid or malformed.",
      );
      return;
    }
    return;
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  try {
    const primitiveSchema = { type: typeof schema };
    AjvStateManager.storeJsonSchema(
      primitiveSchema as JSONSchema,
      `primitive_${cacheKey}`,
    );
    AjvStateManager.getOrCompileValidator(
      primitiveSchema as JSONSchema,
      `primitive_${cacheKey}`,
    );
  } catch (error) {
    logger.warn(
      {
        error,
        schemaType: "primitive",
        cacheKey,
        context: "request_validation",
      },
      "Failed to compile schema for request validation. Schema format may be unsupported.",
    );
  }
};

/**
 * Compiles and caches request body and query validators.
 * Uses the same cache keys as Request.validate() for consistency.
 * This allows runtime validation to hit the pre-compiled cache.
 *
 * This function is called during route registration to pre-compile
 * request schemas defined in swagger options.
 *
 * @param requestBody - Optional request body schema
 * @param query - Optional query parameters schema
 */
export const compileRequestSchemas = (
  requestBody?: RequestSchema,
  query?: RequestSchema,
): void => {
  if (requestBody) {
    compileRequestValidator(requestBody);
  }

  if (query) {
    compileRequestValidator(query);
  }
};

/**
 * Compiles and caches response schemas for a route.
 * Stores both validators and serializers using Ajv's storage.
 *
 * This function is called:
 * - During inline route registration (server.get() with swagger.responses)
 * - During decorator route registration (@controller with @serialize)
 *
 * @param responses - Map of status codes to schemas
 * @returns A map of status codes to schemas, or undefined if no responses
 */
export const compileResponseSchemas = (
  responses?: Record<number, RequestSchema>,
): RouteResponseSchemas | undefined => {
  if (!responses || Object.keys(responses).length === 0) {
    return undefined;
  }

  const responseSchemas: RouteResponseSchemas = {};

  for (const [statusCode, schema] of Object.entries(responses)) {
    const status = Number(statusCode);
    responseSchemas[status] = schema as RequestSchema;

    // Compile and cache validator using Ajv
    compileAndCacheValidator(schema as RequestSchema);

    // Pre-compile serializer for this response schema
    if (ZodLoader.isZodSchema(schema)) {
      try {
        const jsonSchema = ZodLoader.toJSONSchema(schema);
        AjvStateManager.getOrCreateSerializer(jsonSchema, "fast_stringify_zod");
      } catch {
        // Silently skip serializer compilation if schema conversion fails
      }
    } else if (TypeBoxLoader.isTypeBoxSchema(schema)) {
      AjvStateManager.getOrCreateSerializer(
        schema as JSONSchema,
        "fast_stringify_typebox",
      );
    } else if (typeof schema === "object" && schema !== null) {
      AjvStateManager.getOrCreateSerializer(
        schema as JSONSchema,
        "fast_stringify_json",
      );
    }
  }

  return responseSchemas;
};
