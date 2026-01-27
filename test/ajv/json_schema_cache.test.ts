import { describe, it, expect, beforeEach } from "vitest";
import { z, type ZodAny } from "zod";
import { Type } from "@sinclair/typebox";
import {
  getJsonSchemaFromCache,
  cacheJsonSchema,
  clearJsonSchemaCache,
  getJsonSchemaCacheSize,
} from "../../src/ajv/json_schema_cache.js";
import { compileAndCacheValidator } from "../../src/ajv/schema_compiler.js";
import type { JSONSchema } from "../../src/plugins/swagger/swagger_types.js";
import { ZodLoader } from "../../src/validator/zod_loader.js";

describe("JSON Schema Cache", () => {
  beforeEach(() => {
    clearJsonSchemaCache();
  });

  describe("cacheJsonSchema and getJsonSchemaFromCache", () => {
    it("should cache and retrieve Zod schemas", () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const jsonSchema = ZodLoader.toJSONSchema(zodSchema as unknown as ZodAny);
      cacheJsonSchema(zodSchema, jsonSchema);

      const retrieved = getJsonSchemaFromCache(zodSchema);
      expect(retrieved).toBeDefined();
      expect(retrieved).toEqual(jsonSchema);
    });

    it("should cache and retrieve TypeBox schemas", () => {
      const typeboxSchema = Type.Object({
        name: Type.String(),
        age: Type.Number(),
      });

      cacheJsonSchema(typeboxSchema, typeboxSchema as any);

      const retrieved = getJsonSchemaFromCache(typeboxSchema);
      expect(retrieved).toBeDefined();
      expect(retrieved).toEqual(typeboxSchema);
    });

    it("should cache and retrieve plain JSON schemas", () => {
      const jsonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };

      cacheJsonSchema(jsonSchema, jsonSchema as any);

      const retrieved = getJsonSchemaFromCache(jsonSchema);
      expect(retrieved).toBeDefined();
      expect(retrieved).toEqual(jsonSchema);
    });

    it("should return undefined for non-cached schemas", () => {
      const zodSchema = z.object({ name: z.string() });
      const retrieved = getJsonSchemaFromCache(zodSchema);
      expect(retrieved).toBeUndefined();
    });

    it("should return same schema object for repeated lookups", () => {
      const zodSchema = z.object({ name: z.string() });
      const jsonSchema = ZodLoader.toJSONSchema(zodSchema as unknown as ZodAny);
      cacheJsonSchema(zodSchema, jsonSchema as any);

      const first = getJsonSchemaFromCache(zodSchema);
      const second = getJsonSchemaFromCache(zodSchema);

      expect(first).toBe(second);
    });
  });

  describe("clearJsonSchemaCache", () => {
    it("should clear all cached schemas", () => {
      const zodSchema = z.object({ name: z.string() });
      const jsonSchema = ZodLoader.toJSONSchema(zodSchema as unknown as ZodAny);
      cacheJsonSchema(zodSchema, jsonSchema as any);

      expect(getJsonSchemaCacheSize()).toBe(1);

      clearJsonSchemaCache();

      expect(getJsonSchemaCacheSize()).toBe(0);
      expect(getJsonSchemaFromCache(zodSchema)).toBeUndefined();
    });
  });

  describe("getJsonSchemaCacheSize", () => {
    it("should return 0 for empty cache", () => {
      expect(getJsonSchemaCacheSize()).toBe(0);
    });

    it("should return correct count after caching schemas", () => {
      const zodSchema1 = z.object({ name: z.string() });
      const zodSchema2 = z.object({ age: z.number() });
      const typeboxSchema = Type.Object({ email: Type.String() });

      cacheJsonSchema(
        zodSchema1,
        ZodLoader.toJSONSchema(zodSchema1 as unknown as ZodAny),
      );
      expect(getJsonSchemaCacheSize()).toBe(1);

      cacheJsonSchema(
        zodSchema2,
        ZodLoader.toJSONSchema(zodSchema2 as unknown as ZodAny),
      );
      expect(getJsonSchemaCacheSize()).toBe(2);

      cacheJsonSchema(typeboxSchema, typeboxSchema as any);
      expect(getJsonSchemaCacheSize()).toBe(3);
    });

    it("should not increment on duplicate caching", () => {
      const zodSchema = z.object({ name: z.string() });
      const jsonSchema = ZodLoader.toJSONSchema(zodSchema as unknown as ZodAny);

      cacheJsonSchema(zodSchema, jsonSchema);
      expect(getJsonSchemaCacheSize()).toBe(1);

      // Cache same schema again
      cacheJsonSchema(zodSchema, jsonSchema);
      expect(getJsonSchemaCacheSize()).toBe(1);
    });
  });

  describe("Integration with schema_compiler", () => {
    it("should automatically cache JSON Schema when compiling validators", () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      // Before compilation, schema should not be cached
      expect(getJsonSchemaFromCache(zodSchema)).toBeUndefined();

      // Compile the validator (this should also cache the JSON Schema)
      compileAndCacheValidator(zodSchema);

      // After compilation, JSON Schema should be cached
      const cached = getJsonSchemaFromCache(zodSchema);
      expect(cached).toBeDefined();
      expect(cached).toHaveProperty("type");
    });

    it("should cache JSON Schema for TypeBox schemas during compilation", () => {
      const typeboxSchema = Type.Object({
        name: Type.String(),
        age: Type.Number(),
      });

      expect(getJsonSchemaFromCache(typeboxSchema)).toBeUndefined();

      compileAndCacheValidator(typeboxSchema);

      const cached = getJsonSchemaFromCache(typeboxSchema);
      expect(cached).toBeDefined();
      expect(cached).toEqual(typeboxSchema);
    });

    it("should cache JSON Schema for plain JSON schemas during compilation", () => {
      const jsonSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      expect(getJsonSchemaFromCache(jsonSchema)).toBeUndefined();

      compileAndCacheValidator(jsonSchema);

      const cached = getJsonSchemaFromCache(jsonSchema);
      expect(cached).toBeDefined();
      expect(cached).toEqual(jsonSchema);
    });
  });

  describe("Cache key consistency", () => {
    it("should use consistent keys for same Zod schema object", () => {
      const zodSchema = z.object({ name: z.string() });
      const jsonSchema = ZodLoader.toJSONSchema(zodSchema as unknown as ZodAny);

      cacheJsonSchema(zodSchema, jsonSchema as any);

      // Multiple retrievals should return the same cached object
      const first = getJsonSchemaFromCache(zodSchema);
      const second = getJsonSchemaFromCache(zodSchema);
      const third = getJsonSchemaFromCache(zodSchema);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it("should use different keys for different schema objects", () => {
      const zodSchema1 = z.object({ name: z.string() });
      const zodSchema2 = z.object({ name: z.string() });

      cacheJsonSchema(
        zodSchema1,
        ZodLoader.toJSONSchema(zodSchema1 as unknown as ZodAny),
      );
      cacheJsonSchema(
        zodSchema2,
        ZodLoader.toJSONSchema(zodSchema2 as unknown as ZodAny),
      );

      expect(getJsonSchemaCacheSize()).toBe(2);
    });
  });
});
