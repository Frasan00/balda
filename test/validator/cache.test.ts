import { Type } from "@sinclair/typebox";
import { beforeEach, describe, expect, it } from "vitest";
import { AjvStateManager } from "../../src/ajv/ajv.js";

describe("Schema Caching with Ajv", () => {
  beforeEach(() => {
    // Clear Ajv cache before each test
    AjvStateManager.clearAllCaches();
  });

  it("should compile and cache TypeBox schemas in Ajv", () => {
    const UserSchema = Type.Object({
      name: Type.String(),
      age: Type.Number(),
    });

    // Store and compile schema using Ajv
    AjvStateManager.storeJsonSchema(UserSchema, "test_user");
    const validator = AjvStateManager.getOrCompileValidator(
      UserSchema,
      "test_user",
    );

    // Validate with compiled schema
    const validData = { name: "John", age: 30 };
    const isValid = validator(validData);

    expect(isValid).toBe(true);

    // Second access should retrieve from Ajv's internal cache
    const validator2 = AjvStateManager.getOrCompileValidator(
      UserSchema,
      "test_user",
    );
    expect(validator2({ name: "Jane", age: 25 })).toBe(true);
  });

  it("should cache multiple different schemas independently in Ajv", () => {
    const UserSchema = Type.Object({
      name: Type.String(),
    });

    const ProductSchema = Type.Object({
      title: Type.String(),
      price: Type.Number(),
    });

    // Store both schemas in Ajv
    AjvStateManager.storeJsonSchema(UserSchema, "user");
    AjvStateManager.storeJsonSchema(ProductSchema, "product");

    // Get validators
    const userValidator = AjvStateManager.getOrCompileValidator(
      UserSchema,
      "user",
    );
    const productValidator = AjvStateManager.getOrCompileValidator(
      ProductSchema,
      "product",
    );

    // Verify they're different validators
    expect(userValidator).not.toBe(productValidator);

    // Validate with each schema
    expect(userValidator({ name: "John" })).toBe(true);
    expect(productValidator({ title: "Book", price: 10 })).toBe(true);

    // Invalid data should fail
    expect(productValidator({ title: "Book" })).toBe(false); // missing price
    expect(userValidator({ age: 30 })).toBe(false); // missing name
  });

  it("should persist cached schemas across multiple validations", () => {
    const Schema = Type.Object({
      email: Type.String({ format: "email" }),
      age: Type.Number({ minimum: 0, maximum: 150 }),
    });

    const validator = AjvStateManager.getOrCompileValidator(Schema, "email");

    // Multiple validations should work correctly
    expect(validator({ email: "test@example.com", age: 30 })).toBe(true);
    expect(validator({ email: "another@test.com", age: 25 })).toBe(true);

    // Invalid data (missing required field)
    expect(validator({ email: "test@example.com" })).toBe(false);
    // Invalid data (age out of range)
    expect(validator({ email: "test@example.com", age: 200 })).toBe(false);
  });

  it("should handle schema storage and retrieval correctly", () => {
    const Schema = Type.Object({ value: Type.Number() });

    // Store schema
    AjvStateManager.storeJsonSchema(Schema, "number_value");

    // Retrieve and compile
    const validator = AjvStateManager.getOrCompileValidator(
      Schema,
      "number_value",
    );

    expect(validator({ value: 42 })).toBe(true);
    expect(validator({ value: "invalid" })).toBe(false);
  });

  it("should return cached JSON schema when available", () => {
    const Schema = Type.Object({
      name: Type.String(),
      age: Type.Number(),
    });

    // Store schema
    AjvStateManager.storeJsonSchema(Schema, "test_schema");

    // Retrieve it
    const retrieved = AjvStateManager.getJsonSchema(Schema, "test_schema");

    expect(retrieved).toBeDefined();
    expect(retrieved).toEqual(Schema);
  });

  it("should return undefined for non-existent cached schemas", () => {
    const Schema = Type.Object({
      name: Type.String(),
    });

    // Try to retrieve without storing
    const retrieved = AjvStateManager.getJsonSchema(Schema, "non_existent");

    expect(retrieved).toBeUndefined();
  });

  it("should handle cache clearing correctly", () => {
    const Schema = Type.Object({ value: Type.String() });

    // Store and verify
    AjvStateManager.storeJsonSchema(Schema, "clear_test");
    let retrieved = AjvStateManager.getJsonSchema(Schema, "clear_test");
    expect(retrieved).toBeDefined();

    // Clear cache
    AjvStateManager.clearAllCaches();

    // After clearing, schema should not be retrievable
    retrieved = AjvStateManager.getJsonSchema(Schema, "clear_test");
    expect(retrieved).toBeUndefined();
  });

  it("should provide cache statistics", () => {
    const Schema1 = Type.Object({ a: Type.String() });
    const Schema2 = Type.Object({ b: Type.Number() });

    // Store some schemas
    AjvStateManager.storeJsonSchema(Schema1, "schema1");
    AjvStateManager.storeJsonSchema(Schema2, "schema2");

    const stats = AjvStateManager.getCacheStats();

    expect(stats).toBeDefined();
    expect(stats.schemaCount).toBeGreaterThanOrEqual(2);
    expect(stats.totalRefsCreated).toBeGreaterThanOrEqual(2);
  });
});
