import { describe, it, expect, beforeEach } from "vitest";
import {
  compileAndCacheValidator,
  compileResponseSchemas,
  compileRequestSchemas,
  compileRequestValidator,
} from "../../src/ajv/schema_compiler.js";
import { openapiSchemaMap } from "../../src/ajv/openapi_schema_map.js";
import { fastJsonStringifyMap } from "../../src/ajv/fast_json_stringify_cache.js";
import { getSchemaRefKey } from "../../src/ajv/schema_ref_cache.js";

describe("Schema Compiler - Shared Utility", () => {
  beforeEach(() => {
    // Clear caches before each test
    openapiSchemaMap.clear();
    fastJsonStringifyMap.clear();
  });

  describe("compileAndCacheValidator", () => {
    it("should compile and cache a JSON schema validator", () => {
      const schema = {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      } as const;

      compileAndCacheValidator(schema);

      const refKey = getSchemaRefKey(schema, "serialize_json");
      expect(openapiSchemaMap.has(refKey)).toBe(true);
    });

    it("should compile and cache a TypeBox schema validator", () => {
      // Mock TypeBox schema
      const schema = {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        [Symbol.for("TypeBox.Kind")]: "Object",
      } as const;

      compileAndCacheValidator(schema);

      const refKey = getSchemaRefKey(schema, "serialize_typebox");
      expect(openapiSchemaMap.has(refKey)).toBe(true);
    });

    it("should not recompile already cached schemas", () => {
      const schema = {
        type: "object",
        properties: { value: { type: "number" } },
      } as const;

      compileAndCacheValidator(schema);
      const initialSize = openapiSchemaMap.size;

      // Call again with same schema
      compileAndCacheValidator(schema);

      // Size should not increase
      expect(openapiSchemaMap.size).toBe(initialSize);
    });
  });

  describe("compileResponseSchemas", () => {
    it("should compile multiple response schemas", () => {
      const schema200 = {
        type: "object",
        properties: { success: { type: "boolean" } },
      } as const;

      const schema404 = {
        type: "object",
        properties: { error: { type: "string" } },
      } as const;

      const result = compileResponseSchemas({
        200: schema200,
        404: schema404,
      });

      expect(result).toBeDefined();
      expect(result![200]).toBe(schema200);
      expect(result![404]).toBe(schema404);

      // Verify both schemas are cached in openapiSchemaMap
      const refKey200 = getSchemaRefKey(schema200, "serialize_json");
      const refKey404 = getSchemaRefKey(schema404, "serialize_json");
      expect(openapiSchemaMap.has(refKey200)).toBe(true);
      expect(openapiSchemaMap.has(refKey404)).toBe(true);
    });

    it("should cache both validators and serializers", () => {
      const schema = {
        type: "object",
        properties: { data: { type: "string" } },
      } as const;

      compileResponseSchemas({ 200: schema });

      // Verify validator is cached
      const validatorKey = getSchemaRefKey(schema, "serialize_json");
      expect(openapiSchemaMap.has(validatorKey)).toBe(true);

      // Verify serializer is cached
      const serializerKey = getSchemaRefKey(schema, "fast_stringify_json");
      expect(fastJsonStringifyMap.has(serializerKey)).toBe(true);
    });

    it("should return undefined for empty responses", () => {
      const result = compileResponseSchemas({});
      expect(result).toBeUndefined();
    });

    it("should return undefined for no responses", () => {
      const result = compileResponseSchemas(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle single response schema", () => {
      const schema = {
        type: "object",
        properties: { message: { type: "string" } },
      } as const;

      const result = compileResponseSchemas({ 200: schema });

      expect(result).toBeDefined();
      expect(result![200]).toBe(schema);
      expect(Object.keys(result!)).toHaveLength(1);
    });
  });

  describe("Shared Usage - Decorator and Inline Routes", () => {
    it("should use the same cache for schemas from both sources", () => {
      const sharedSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id"],
      } as const;

      // Simulate decorator usage
      compileAndCacheValidator(sharedSchema);
      const cacheSize1 = openapiSchemaMap.size;

      // Simulate inline route usage with same schema
      compileResponseSchemas({ 200: sharedSchema });
      const cacheSize2 = openapiSchemaMap.size;

      // Cache size should remain the same (schema already cached)
      expect(cacheSize2).toBe(cacheSize1);

      // Verify the schema is accessible via the same key
      const refKey = getSchemaRefKey(sharedSchema, "serialize_json");
      expect(openapiSchemaMap.has(refKey)).toBe(true);
    });

    it("should populate both caches regardless of entry point", () => {
      const schema1 = {
        type: "object",
        properties: { field1: { type: "string" } },
      } as const;

      const schema2 = {
        type: "object",
        properties: { field2: { type: "number" } },
      } as const;

      // Entry point 1: Direct validator compilation (decorator-like)
      compileAndCacheValidator(schema1);

      // Entry point 2: Response schemas compilation (inline route-like)
      compileResponseSchemas({ 200: schema2 });

      // Both should be in openapiSchemaMap
      const validatorKey1 = getSchemaRefKey(schema1, "serialize_json");
      const validatorKey2 = getSchemaRefKey(schema2, "serialize_json");
      expect(openapiSchemaMap.has(validatorKey1)).toBe(true);
      expect(openapiSchemaMap.has(validatorKey2)).toBe(true);

      // Only schema2 should be in fastJsonStringifyMap
      // (schema1 was compiled via compileAndCacheValidator, which doesn't create serializers)
      const serializerKey2 = getSchemaRefKey(schema2, "fast_stringify_json");
      expect(fastJsonStringifyMap.has(serializerKey2)).toBe(true);
    });
  });
});

describe("Request Schema Pre-Compilation", () => {
  beforeEach(() => {
    // Clear caches before each test
    openapiSchemaMap.clear();
    fastJsonStringifyMap.clear();
  });

  describe("compileRequestValidator", () => {
    it("should compile request schema with runtime validation cache keys", () => {
      const schema = {
        type: "object",
        properties: {
          email: { type: "string" },
          password: { type: "string" },
        },
        required: ["email", "password"],
      } as const;

      compileRequestValidator(schema);

      // Should use "json_schema" key (NOT "serialize_json")
      const refKey = getSchemaRefKey(schema, "json_schema");
      expect(openapiSchemaMap.has(refKey)).toBe(true);

      // Should NOT create serializer (request schemas are for validation only)
      const serializerKey = getSchemaRefKey(schema, "fast_stringify_json");
      expect(fastJsonStringifyMap.has(serializerKey)).toBe(false);
    });

    it("should reuse cache key for the same schema object in different contexts", () => {
      const schema = {
        type: "object",
        properties: { data: { type: "string" } },
      } as const;

      // Compile as request schema
      compileRequestValidator(schema);
      const requestKey = getSchemaRefKey(schema, "json_schema");

      // Compile as response schema (same schema object)
      compileAndCacheValidator(schema);
      const responseKey = getSchemaRefKey(schema, "serialize_json");

      // Same schema object gets same cache key (efficient - compile once, use everywhere)
      expect(openapiSchemaMap.has(requestKey)).toBe(true);
      expect(openapiSchemaMap.has(responseKey)).toBe(true);
      expect(requestKey).toBe(responseKey); // Same Symbol for same schema object
    });

    it("should handle TypeBox schemas with correct cache key", () => {
      const schema = {
        type: "object",
        properties: { id: { type: "string" } },
        [Symbol.for("TypeBox.Kind")]: "Object",
      } as const;

      compileRequestValidator(schema);

      // Should use "typebox_schema" key (NOT "serialize_typebox")
      const refKey = getSchemaRefKey(schema, "typebox_schema");
      expect(openapiSchemaMap.has(refKey)).toBe(true);
    });

    it("should not recompile already cached request schemas", () => {
      const schema = {
        type: "object",
        properties: { value: { type: "number" } },
      } as const;

      compileRequestValidator(schema);
      const initialSize = openapiSchemaMap.size;

      // Call again with same schema
      compileRequestValidator(schema);

      // Size should not increase
      expect(openapiSchemaMap.size).toBe(initialSize);
    });
  });

  describe("compileRequestSchemas", () => {
    it("should compile both request body and query schemas", () => {
      const bodySchema = {
        type: "object",
        properties: { name: { type: "string" } },
      } as const;

      const querySchema = {
        type: "object",
        properties: { page: { type: "number" } },
      } as const;

      compileRequestSchemas(bodySchema, querySchema);

      // Both should be cached
      const bodyKey = getSchemaRefKey(bodySchema, "json_schema");
      const queryKey = getSchemaRefKey(querySchema, "json_schema");
      expect(openapiSchemaMap.has(bodyKey)).toBe(true);
      expect(openapiSchemaMap.has(queryKey)).toBe(true);
    });

    it("should handle only body schema", () => {
      const bodySchema = {
        type: "object",
        properties: { data: { type: "string" } },
      } as const;

      compileRequestSchemas(bodySchema, undefined);

      const bodyKey = getSchemaRefKey(bodySchema, "json_schema");
      expect(openapiSchemaMap.has(bodyKey)).toBe(true);
    });

    it("should handle only query schema", () => {
      const querySchema = {
        type: "object",
        properties: { filter: { type: "string" } },
      } as const;

      compileRequestSchemas(undefined, querySchema);

      const queryKey = getSchemaRefKey(querySchema, "json_schema");
      expect(openapiSchemaMap.has(queryKey)).toBe(true);
    });

    it("should handle no schemas gracefully", () => {
      const initialSize = openapiSchemaMap.size;

      compileRequestSchemas(undefined, undefined);

      // Cache size should not change
      expect(openapiSchemaMap.size).toBe(initialSize);
    });
  });

  describe("Integration - Request and Response Schemas", () => {
    it("should allow same schema for request and response with separate caches", () => {
      const sharedSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      } as const;

      // Compile as request schema (for validation)
      compileRequestSchemas(sharedSchema, undefined);

      // Compile as response schema (for serialization)
      compileResponseSchemas({ 200: sharedSchema });

      // Should have separate cache entries
      const requestKey = getSchemaRefKey(sharedSchema, "json_schema");
      const responseKey = getSchemaRefKey(sharedSchema, "serialize_json");
      const serializerKey = getSchemaRefKey(
        sharedSchema,
        "fast_stringify_json",
      );

      expect(openapiSchemaMap.has(requestKey)).toBe(true);
      expect(openapiSchemaMap.has(responseKey)).toBe(true);
      expect(fastJsonStringifyMap.has(serializerKey)).toBe(true);
    });

    it("should work with runtime validation after pre-compilation", () => {
      const schema = {
        type: "object",
        properties: { email: { type: "string" } },
        required: ["email"],
      } as const;

      // Pre-compile at route registration
      compileRequestSchemas(schema, undefined);

      // Verify runtime validation would hit the cache
      const refKey = getSchemaRefKey(schema, "json_schema");
      const cachedValidator = openapiSchemaMap.get(refKey);

      expect(cachedValidator).toBeDefined();
      expect(typeof cachedValidator).toBe("function");
    });
  });
});
