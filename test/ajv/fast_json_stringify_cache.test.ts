import { Type } from "@sinclair/typebox";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";
import {
  clearSerializerCache,
  fastJsonStringifyMap,
  getOrCreateSerializer,
  getSerializerCacheStats,
} from "../../src/ajv/fast_json_stringify_cache.js";
import { ZodLoader } from "../../src/validator/zod_loader.js";

describe("fast-json-stringify Cache", () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearSerializerCache();
  });

  describe("getOrCreateSerializer", () => {
    it("should return null when no schema is provided", () => {
      const serializer = getOrCreateSerializer(undefined);
      expect(serializer).toBeNull();
    });

    it("should cache and reuse Zod schema serializers", () => {
      const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      // First call - should create and cache serializer
      const serializer1 = getOrCreateSerializer(UserSchema);
      expect(serializer1).toBeDefined();
      expect(typeof serializer1).toBe("function");

      // Verify cache has one entry
      expect(fastJsonStringifyMap.size).toBe(1);

      // Second call - should return cached serializer
      const serializer2 = getOrCreateSerializer(UserSchema);
      expect(serializer2).toBe(serializer1); // Same reference

      // Cache size should remain the same
      expect(fastJsonStringifyMap.size).toBe(1);

      // Test serialization produces correct JSON
      const data = { name: "John", age: 30 };
      const serialized = serializer1!(data);
      expect(serialized).toBe(JSON.stringify(data));

      // Verify it's valid JSON
      expect(JSON.parse(serialized)).toEqual(data);
    });

    it("should cache and reuse TypeBox schema serializers", () => {
      const ProductSchema = Type.Object({
        title: Type.String(),
        price: Type.Number(),
      });

      // First call - should create and cache serializer
      const serializer1 = getOrCreateSerializer(ProductSchema);
      expect(serializer1).toBeDefined();
      expect(typeof serializer1).toBe("function");

      // Verify cache has one entry
      expect(fastJsonStringifyMap.size).toBe(1);

      // Second call - should return cached serializer
      const serializer2 = getOrCreateSerializer(ProductSchema);
      expect(serializer2).toBe(serializer1); // Same reference

      // Test serialization
      const data = { title: "Book", price: 10 };
      const serialized = serializer1!(data);
      expect(serialized).toBe(JSON.stringify(data));
    });

    it("should cache and reuse plain JSON schema serializers", () => {
      const JsonSchema = {
        type: "object" as const,
        properties: {
          email: { type: "string" as const, format: "email" as const },
          active: { type: "boolean" as const },
        },
        required: ["email", "active"],
        additionalProperties: false,
      };

      // First call - should create and cache serializer
      const serializer1 = getOrCreateSerializer(JsonSchema);
      expect(serializer1).toBeDefined();
      expect(typeof serializer1).toBe("function");

      // Verify cache has one entry
      expect(fastJsonStringifyMap.size).toBe(1);

      // Second call - should return cached serializer
      const serializer2 = getOrCreateSerializer(JsonSchema);
      expect(serializer2).toBe(serializer1); // Same reference

      // Test serialization
      const data = { email: "test@example.com", active: true };
      const serialized = serializer1!(data);
      expect(serialized).toBe(JSON.stringify(data));
    });

    it("should cache different schemas independently", () => {
      const UserSchema = z.object({
        name: z.string(),
      });

      const ProductSchema = Type.Object({
        title: Type.String(),
      });

      const JsonSchema = {
        type: "object" as const,
        properties: {
          value: { type: "number" as const },
        },
      };

      // Create serializers for all three schemas
      const userSerializer = getOrCreateSerializer(UserSchema);
      const productSerializer = getOrCreateSerializer(ProductSchema);
      const jsonSerializer = getOrCreateSerializer(JsonSchema);

      // Verify all are different functions
      expect(userSerializer).not.toBe(productSerializer);
      expect(userSerializer).not.toBe(jsonSerializer);
      expect(productSerializer).not.toBe(jsonSerializer);

      // Verify cache has three entries
      expect(fastJsonStringifyMap.size).toBe(3);

      // Test each serializer works correctly
      expect(userSerializer!({ name: "John" })).toBe('{"name":"John"}');
      expect(productSerializer!({ title: "Book" })).toBe('{"title":"Book"}');
      expect(jsonSerializer!({ value: 42 })).toBe('{"value":42}');
    });
  });

  describe("clearSerializerCache", () => {
    it("should clear all cached serializers", () => {
      const Schema1 = z.object({ name: z.string() });
      const Schema2 = Type.Object({ value: Type.Number() });

      // Add two serializers to cache
      getOrCreateSerializer(Schema1);
      getOrCreateSerializer(Schema2);

      expect(fastJsonStringifyMap.size).toBe(2);

      // Clear cache
      clearSerializerCache();

      expect(fastJsonStringifyMap.size).toBe(0);
    });

    it("should allow re-creating serializers after clearing", () => {
      const Schema = z.object({ name: z.string() });

      // Create and cache serializer
      const serializer1 = getOrCreateSerializer(Schema);
      expect(fastJsonStringifyMap.size).toBe(1);

      // Clear cache
      clearSerializerCache();
      expect(fastJsonStringifyMap.size).toBe(0);

      // Re-create serializer
      const serializer2 = getOrCreateSerializer(Schema);
      expect(fastJsonStringifyMap.size).toBe(1);
      expect(serializer2).toBeDefined();

      // Serializers should be different functions (new compilation)
      expect(serializer2).not.toBe(serializer1);

      // But should produce the same output
      const data = { name: "John" };
      expect(serializer1!(data)).toBe(serializer2!(data));
    });
  });

  describe("getSerializerCacheStats", () => {
    it("should return empty stats when cache is empty", () => {
      const stats = getSerializerCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.schemaRefsCreated).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    it("should return correct stats for cached serializers", () => {
      const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const ProductSchema = Type.Object({
        title: Type.String(),
        price: Type.Number(),
      });

      // Create serializers
      getOrCreateSerializer(UserSchema);
      getOrCreateSerializer(ProductSchema);

      const stats = getSerializerCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.schemaRefsCreated).toBe(2);
      expect(stats.entries).toHaveLength(2);

      // Verify entry structure
      const entry = stats.entries[0];
      expect(entry).toHaveProperty("key");
      expect(entry).toHaveProperty("compiledAt");
      expect(entry).toHaveProperty("schemaType");
      expect(typeof entry.compiledAt).toBe("number");
      expect(typeof entry.schemaType).toBe("string");
      expect(entry.schemaType).toMatch(/^schema:/);
    });

    it("should track schemaRefsCreated count incrementally", () => {
      const Schema1 = z.object({ value: z.number() });
      const Schema2 = Type.Object({ name: Type.String() });
      const Schema3 = { type: "object" as const, properties: {} };

      getOrCreateSerializer(Schema1);
      expect(getSerializerCacheStats().schemaRefsCreated).toBe(1);

      getOrCreateSerializer(Schema2);
      expect(getSerializerCacheStats().schemaRefsCreated).toBe(2);

      getOrCreateSerializer(Schema3);
      expect(getSerializerCacheStats().schemaRefsCreated).toBe(3);

      // Reusing same schema should not increment count
      getOrCreateSerializer(Schema1);
      expect(getSerializerCacheStats().schemaRefsCreated).toBe(3);
    });

    it("should track compilation time correctly", () => {
      const Schema = z.object({ value: z.string() });

      const beforeCompile = Date.now();
      getOrCreateSerializer(Schema);
      const afterCompile = Date.now();

      const stats = getSerializerCacheStats();
      const compiledAt = stats.entries[0].compiledAt;

      expect(compiledAt).toBeGreaterThanOrEqual(beforeCompile);
      expect(compiledAt).toBeLessThanOrEqual(afterCompile);
    });
  });

  describe("error handling", () => {
    it("should return null and log error when schema compilation fails", () => {
      // Spy on console.error
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Create an invalid schema that will cause compilation to fail
      // Using a circular reference which fast-json-stringify can't handle
      const invalidSchema: any = { type: "object" };
      invalidSchema.properties = { self: invalidSchema };

      const serializer = getOrCreateSerializer(invalidSchema);

      // Should return null (fallback to JSON.stringify)
      expect(serializer).toBeNull();

      // Should have logged an error
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain(
        "Failed to compile fast-json-stringify serializer",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("serialization behavior", () => {
    it("should serialize objects correctly with Zod schema", () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
      });

      const serializer = getOrCreateSerializer(UserSchema);
      expect(serializer).toBeDefined();

      const data = { id: 1, name: "John Doe", email: "john@example.com" };
      const serialized = serializer!(data);

      expect(serialized).toBe(JSON.stringify(data));
      expect(JSON.parse(serialized)).toEqual(data);
    });

    it("should serialize arrays correctly with TypeBox schema", () => {
      const UserSchema = Type.Object({
        id: Type.Number(),
        name: Type.String(),
      });

      const ArraySchema = Type.Array(UserSchema);

      const serializer = getOrCreateSerializer(ArraySchema);
      expect(serializer).toBeDefined();

      const data = [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ];
      const serialized = serializer!(data);

      expect(serialized).toBe(JSON.stringify(data));
      expect(JSON.parse(serialized)).toEqual(data);
    });

    it("should serialize nested objects correctly with JSON schema", () => {
      const NestedSchema = {
        type: "object" as const,
        properties: {
          user: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              address: {
                type: "object" as const,
                properties: {
                  city: { type: "string" as const },
                  country: { type: "string" as const },
                },
                required: ["city", "country"],
              },
            },
            required: ["name", "address"],
          },
        },
        required: ["user"],
      };

      const serializer = getOrCreateSerializer(NestedSchema);
      expect(serializer).toBeDefined();

      const data = {
        user: {
          name: "John",
          address: {
            city: "New York",
            country: "USA",
          },
        },
      };
      const serialized = serializer!(data);

      expect(serialized).toBe(JSON.stringify(data));
      expect(JSON.parse(serialized)).toEqual(data);
    });

    it("should handle special characters in strings", () => {
      const Schema = z.object({
        message: z.string(),
        emoji: z.string(),
      });

      const serializer = getOrCreateSerializer(Schema);
      expect(serializer).toBeDefined();

      const data = {
        message: 'Hello "World"\nNew line\tTab',
        emoji: "🚀 Rocket",
      };
      const serialized = serializer!(data);

      expect(serialized).toBe(JSON.stringify(data));
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(data);
    });

    it("should handle null and undefined values in optional fields", () => {
      const Schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      });

      const serializer = getOrCreateSerializer(Schema);
      expect(serializer).toBeDefined();

      const data = {
        required: "value",
        optional: undefined,
        nullable: null,
      };
      const serialized = serializer!(data);

      // fast-json-stringify may handle undefined differently
      expect(serialized).toContain("required");
      expect(serialized).toContain("value");
    });
  });

  describe("cache behavior with WeakMap", () => {
    it("should use WeakMap for schema object references", () => {
      // Create two identical but different schema objects
      const Schema1 = z.object({ value: z.number() });
      const Schema2 = z.object({ value: z.number() });

      // Even though schemas are identical, they're different object references
      // so they should create different cache entries
      const serializer1 = getOrCreateSerializer(Schema1);
      const serializer2 = getOrCreateSerializer(Schema2);

      // Should have two cache entries (different object references)
      expect(fastJsonStringifyMap.size).toBe(2);
      expect(serializer1).not.toBe(serializer2);
    });

    it("should reuse cache for same schema object reference", () => {
      const Schema = z.object({ value: z.number() });

      // Same schema object reference
      const serializer1 = getOrCreateSerializer(Schema);
      const serializer2 = getOrCreateSerializer(Schema);

      // Should have one cache entry
      expect(fastJsonStringifyMap.size).toBe(1);
      expect(serializer1).toBe(serializer2);
    });
  });
});
