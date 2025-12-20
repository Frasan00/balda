import { Type } from "@sinclair/typebox";
import { beforeEach, describe, expect, it } from "vitest";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { openapiSchemaMap } from "../../src/ajv/openapi_schema_map.js";

describe("Schema Caching", () => {
  beforeEach(() => {
    // Clear the cache before each test
    openapiSchemaMap.clear();
  });

  it("should cache TypeBox schemas and reuse compiled versions", () => {
    const UserSchema = Type.Object({
      name: Type.String(),
      age: Type.Number(),
    });

    // Get initial cache size
    const initialSize = openapiSchemaMap.size;
    expect(initialSize).toBe(0);

    // First compilation - should add to cache
    const compiled1 = AjvStateManager.ajv.compile(UserSchema);
    const cacheKey1 = Symbol("test_schema_1");
    openapiSchemaMap.set(cacheKey1, compiled1);

    // Verify it was added to cache
    expect(openapiSchemaMap.size).toBe(1);
    expect(openapiSchemaMap.has(cacheKey1)).toBe(true);

    // Second access - should retrieve from cache
    const cached = openapiSchemaMap.get(cacheKey1);
    expect(cached).toBeDefined();
    expect(cached).toBe(compiled1); // Same reference

    // Cache size should remain the same
    expect(openapiSchemaMap.size).toBe(1);

    // Validate with cached schema
    const validData = { name: "John", age: 30 };
    const isValid1 = compiled1(validData);
    const isValid2 = cached!(validData);

    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it("should cache multiple different schemas independently", () => {
    const UserSchema = Type.Object({
      name: Type.String(),
    });

    const ProductSchema = Type.Object({
      title: Type.String(),
      price: Type.Number(),
    });

    // Compile and cache both schemas
    const compiledUser = AjvStateManager.ajv.compile(UserSchema);
    const compiledProduct = AjvStateManager.ajv.compile(ProductSchema);

    const userKey = Symbol("user_schema");
    const productKey = Symbol("product_schema");

    openapiSchemaMap.set(userKey, compiledUser);
    openapiSchemaMap.set(productKey, compiledProduct);

    // Verify both are cached
    expect(openapiSchemaMap.size).toBe(2);
    expect(openapiSchemaMap.has(userKey)).toBe(true);
    expect(openapiSchemaMap.has(productKey)).toBe(true);

    // Retrieve and verify they're different
    const cachedUser = openapiSchemaMap.get(userKey);
    const cachedProduct = openapiSchemaMap.get(productKey);

    expect(cachedUser).not.toBe(cachedProduct);

    // Validate with each cached schema
    expect(cachedUser!({ name: "John" })).toBe(true);
    expect(cachedProduct!({ title: "Book", price: 10 })).toBe(true);

    // Invalid data should fail (missing required field)
    expect(cachedProduct!({ title: "Book" })).toBe(false); // missing price
    expect(cachedUser!({ age: 30 })).toBe(false); // missing name
  });

  it("should persist cached schemas across multiple validations", () => {
    const Schema = Type.Object({
      email: Type.String({ format: "email" }),
    });

    const compiled = AjvStateManager.ajv.compile(Schema);
    const key = Symbol("email_schema");
    openapiSchemaMap.set(key, compiled);

    // First validation
    const valid1 = openapiSchemaMap.get(key)!({ email: "test@example.com" });
    expect(valid1).toBe(true);

    // Second validation - same cached instance
    const valid2 = openapiSchemaMap.get(key)!({ email: "another@test.com" });
    expect(valid2).toBe(true);

    // Invalid email
    const invalid = openapiSchemaMap.get(key)!({ email: "not-an-email" });
    expect(invalid).toBe(false);

    // Cache should still have exactly one entry
    expect(openapiSchemaMap.size).toBe(1);
  });

  it("should handle symbol and string keys correctly", () => {
    const Schema = Type.Object({ value: Type.Number() });
    const compiled = AjvStateManager.ajv.compile(Schema);

    // Test with symbol key
    const symbolKey = Symbol("symbol_cache_key");
    openapiSchemaMap.set(symbolKey, compiled);
    expect(openapiSchemaMap.has(symbolKey)).toBe(true);
    expect(openapiSchemaMap.get(symbolKey)).toBe(compiled);

    // Test with string key
    const stringKey = "string_cache_key";
    openapiSchemaMap.set(stringKey, compiled);
    expect(openapiSchemaMap.has(stringKey)).toBe(true);
    expect(openapiSchemaMap.get(stringKey)).toBe(compiled);

    // Both should be in cache
    expect(openapiSchemaMap.size).toBe(2);
  });
});
