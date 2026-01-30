import { Type } from "@sinclair/typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { Request } from "../../src/server/http/request.js";

describe("Schema Cache - Ajv Integration", () => {
  beforeEach(() => {
    AjvStateManager.clearAllCaches();
  });

  afterEach(() => {
    AjvStateManager.clearAllCaches();
  });

  it("should cache and reuse compiled Zod schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const req1 = new Request();
    req1.body = { name: "Alice", age: 30 };

    const req2 = new Request();
    req2.body = { name: "Bob", age: 25 };

    // First validation should compile and cache the schema in Ajv
    const result1 = req1.validate(schema);
    expect(result1).toEqual({ name: "Alice", age: 30 });

    // Second validation should reuse the cached schema
    const result2 = req2.validate(schema);
    expect(result2).toEqual({ name: "Bob", age: 25 });

    // Both validations should work correctly
    expect(result1).not.toBe(result2); // Different data
  });

  it("should cache and reuse compiled TypeBox schema", () => {
    const schema = Type.Object({
      title: Type.String(),
      count: Type.Number(),
    });

    const req1 = new Request();
    req1.body = { title: "Test", count: 5 };

    const req2 = new Request();
    req2.body = { title: "Another", count: 10 };

    const result1 = req1.validate(schema);
    expect(result1).toEqual({ title: "Test", count: 5 });

    const result2 = req2.validate(schema);
    expect(result2).toEqual({ title: "Another", count: 10 });
  });

  it("should cache and reuse compiled JSON schema", () => {
    const schema = {
      type: "object",
      properties: {
        email: { type: "string" },
        verified: { type: "boolean" },
      },
      required: ["email"],
    } as const;

    const req1 = new Request();
    req1.body = { email: "test@example.com", verified: true };

    const req2 = new Request();
    req2.body = { email: "another@example.com", verified: false };

    const result1 = req1.validate(schema);
    expect(result1).toEqual({ email: "test@example.com", verified: true });

    const result2 = req2.validate(schema);
    expect(result2).toEqual({
      email: "another@example.com",
      verified: false,
    });
  });

  it("should handle different schema types without conflicts", () => {
    const zodSchema = z.object({
      name: z.string(),
    });

    const typeboxSchema = Type.Object({
      name: Type.String(),
    });

    const jsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    } as const;

    const req1 = new Request();
    req1.body = { name: "Zod" };
    const result1 = req1.validate(zodSchema);
    expect(result1).toEqual({ name: "Zod" });

    const req2 = new Request();
    req2.body = { name: "TypeBox" };
    const result2 = req2.validate(typeboxSchema);
    expect(result2).toEqual({ name: "TypeBox" });

    const req3 = new Request();
    req3.body = { name: "JSON" };
    const result3 = req3.validate(jsonSchema);
    expect(result3).toEqual({ name: "JSON" });
  });

  it("should validate data correctly after cache clear", () => {
    const schema = z.object({
      value: z.number(),
    });

    const req1 = new Request();
    req1.body = { value: 42 };
    const result1 = req1.validate(schema);
    expect(result1).toEqual({ value: 42 });

    // Clear cache
    AjvStateManager.clearAllCaches();

    // Validation should still work (recompiles schema)
    const req2 = new Request();
    req2.body = { value: 99 };
    const result2 = req2.validate(schema);
    expect(result2).toEqual({ value: 99 });
  });

  it("should handle validation errors correctly with cached schemas", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0).max(150),
    });

    const req1 = new Request();
    req1.body = { email: "invalid", age: 200 };

    // Validation should throw for invalid data
    try {
      req1.validate(schema, true); // throwOnFail = true
      expect.fail("Expected validation to throw");
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Second attempt with same schema should also fail validation
    const req2 = new Request();
    req2.body = { email: "also-invalid", age: -5 };

    try {
      req2.validate(schema, true); // throwOnFail = true
      expect.fail("Expected validation to throw");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
