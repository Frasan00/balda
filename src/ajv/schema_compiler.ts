import { AjvStateManager } from "./ajv.js";
import { openapiSchemaMap } from "./openapi_schema_map.js";
import { getSchemaRefKey } from "./schema_ref_cache.js";
import { getOrCreateSerializer } from "./fast_json_stringify_cache.js";
import { cacheJsonSchema } from "./json_schema_cache.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { ZodLoader } from "../validator/zod_loader.js";
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import type { RouteResponseSchemas } from "../server/router/router_type.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import { logger } from "../logger/logger.js";

/**
 * Compiles and caches a schema validator in openapiSchemaMap.
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
    const refKey = getSchemaRefKey(schema, "serialize_zod");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        const jsonSchema = ZodLoader.toJSONSchema(schema);
        cacheJsonSchema(schema, jsonSchema);
        const compiled = AjvStateManager.ajv.compile(jsonSchema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "zod",
            cacheKey: refKey.description,
            context: "serialize_decorator",
          },
          "Failed to compile Zod schema for validation. Schema may contain unsupported types (e.g., z.instanceof). Runtime validation will still work, but Swagger documentation may be incomplete.",
        );
        // Some Zod schemas (e.g., z.instanceof) cannot be converted to JSON Schema
        // These schemas won't be available for Swagger documentation
        // Silently skip caching - the schema can still be used for runtime validation
        return;
      }
    }
    return;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "serialize_typebox");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        cacheJsonSchema(schema, schema as JSONSchema);
        const compiled = AjvStateManager.ajv.compile(schema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "typebox",
            cacheKey: refKey.description,
            context: "serialize_decorator",
          },
          "Failed to compile TypeBox schema for validation. Schema may be invalid or use unsupported features.",
        );
        return;
      }
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    const refKey = getSchemaRefKey(schema, "serialize_json");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        cacheJsonSchema(schema, schema as JSONSchema);
        const compiled = AjvStateManager.ajv.compile(schema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "json",
            cacheKey: refKey.description,
            context: "serialize_decorator",
          },
          "Failed to compile JSON schema for validation. Schema may be invalid or malformed.",
        );
        return;
      }
    }
    return;
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  if (!openapiSchemaMap.has(cacheKey)) {
    try {
      const compiled = AjvStateManager.ajv.compile(schema);
      openapiSchemaMap.set(cacheKey, compiled);
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
    const refKey = getSchemaRefKey(schema, "zod_schema");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        const jsonSchema = ZodLoader.toJSONSchema(schema);
        cacheJsonSchema(schema, jsonSchema);
        const compiled = AjvStateManager.ajv.compile(jsonSchema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "zod",
            cacheKey: refKey.description,
            context: "request_validation",
          },
          "Failed to compile Zod schema for request validation. Schema may contain unsupported types (e.g., z.instanceof). Swagger documentation may be incomplete.",
        );
        return;
      }
    }
    return;
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const refKey = getSchemaRefKey(schema, "typebox_schema");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        cacheJsonSchema(schema, schema as JSONSchema);
        const compiled = AjvStateManager.ajv.compile(schema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "typebox",
            cacheKey: refKey.description,
            context: "request_validation",
          },
          "Failed to compile TypeBox schema for request validation. Schema may be invalid or use unsupported features.",
        );
        return;
      }
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    const refKey = getSchemaRefKey(schema, "json_schema");
    if (!openapiSchemaMap.has(refKey)) {
      try {
        cacheJsonSchema(schema, schema as JSONSchema);
        const compiled = AjvStateManager.ajv.compile(schema);
        openapiSchemaMap.set(refKey, compiled);
      } catch (error) {
        logger.warn(
          {
            error,
            schemaType: "json",
            cacheKey: refKey.description,
            context: "request_validation",
          },
          "Failed to compile JSON schema for request validation. Schema may be invalid or malformed.",
        );
        return;
      }
    }
    return;
  }

  // Fallback for primitives or edge cases
  const cacheKey = JSON.stringify(schema);
  if (!openapiSchemaMap.has(cacheKey)) {
    try {
      const compiled = AjvStateManager.ajv.compile(schema);
      openapiSchemaMap.set(cacheKey, compiled);
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
 * Stores both validators (openapiSchemaMap) and serializers (fastJsonStringifyMap).
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

    // Compile and cache validator in openapiSchemaMap
    compileAndCacheValidator(schema as RequestSchema);

    // Compile and cache serializer in fastJsonStringifyMap
    getOrCreateSerializer(schema as RequestSchema);
  }

  return responseSchemas;
};
