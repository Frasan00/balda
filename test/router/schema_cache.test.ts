import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { Type } from "@sinclair/typebox";
import { Request } from "../../src/server/http/request.js";
import {
  getSchemaRefCount,
  resetSchemaRefCache,
} from "../../src/ajv/schema_ref_cache.js";
import { openapiSchemaMap } from "../../src/ajv/openapi_schema_map.js";

describe("Schema Cache Deduplication", () => {
  beforeEach(() => {
    resetSchemaRefCache();
    openapiSchemaMap.clear();
  });

  afterEach(() => {
    resetSchemaRefCache();
    openapiSchemaMap.clear();
  });

  it("should reuse compiled schema for same Zod schema object", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const req1 = new Request();
    req1.body = { name: "Alice", age: 30 };

    const req2 = new Request();
    req2.body = { name: "Bob", age: 25 };

    // First validation should compile the schema
    const initialRefCount = getSchemaRefCount();
    const result1 = req1.validate(schema);
    const afterFirstCount = getSchemaRefCount();

    expect(result1).toEqual({ name: "Alice", age: 30 });
    expect(afterFirstCount).toBe(initialRefCount + 1);

    // Second validation should reuse the compiled schema
    const result2 = req2.validate(schema);
    const afterSecondCount = getSchemaRefCount();

    expect(result2).toEqual({ name: "Bob", age: 25 });
    expect(afterSecondCount).toBe(afterFirstCount); // No new schema ref created
  });

  it("should reuse compiled schema for same TypeBox schema object", () => {
    const schema = Type.Object({
      title: Type.String(),
      count: Type.Number(),
    });

    const req1 = new Request();
    req1.body = { title: "Test", count: 5 };

    const req2 = new Request();
    req2.body = { title: "Another", count: 10 };

    const initialRefCount = getSchemaRefCount();
    const result1 = req1.validate(schema);
    const afterFirstCount = getSchemaRefCount();

    expect(result1).toEqual({ title: "Test", count: 5 });
    expect(afterFirstCount).toBe(initialRefCount + 1);

    const result2 = req2.validate(schema);
    const afterSecondCount = getSchemaRefCount();

    expect(result2).toEqual({ title: "Another", count: 10 });
    expect(afterSecondCount).toBe(afterFirstCount);
  });

  it("should reuse compiled schema for same plain JSON schema object", () => {
    const schema = {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        verified: { type: "boolean" },
      },
      required: ["email"],
    };

    const req1 = new Request();
    req1.body = { email: "test@example.com", verified: true };

    const req2 = new Request();
    req2.body = { email: "another@example.com", verified: false };

    const initialRefCount = getSchemaRefCount();
    const result1 = req1.validate(schema);
    const afterFirstCount = getSchemaRefCount();

    expect(result1).toEqual({ email: "test@example.com", verified: true });
    expect(afterFirstCount).toBe(initialRefCount + 1);

    const result2 = req2.validate(schema);
    const afterSecondCount = getSchemaRefCount();

    expect(result2).toEqual({ email: "another@example.com", verified: false });
    expect(afterSecondCount).toBe(afterFirstCount);
  });

  it("should create separate schema refs for different schema objects", () => {
    const schema1 = z.object({ name: z.string() });
    const schema2 = z.object({ title: z.string() });

    const req1 = new Request();
    req1.body = { name: "Alice" };

    const req2 = new Request();
    req2.body = { title: "Test" };

    const initialRefCount = getSchemaRefCount();
    req1.validate(schema1);
    const afterFirstCount = getSchemaRefCount();

    expect(afterFirstCount).toBe(initialRefCount + 1);

    req2.validate(schema2);
    const afterSecondCount = getSchemaRefCount();

    expect(afterSecondCount).toBe(afterFirstCount + 1); // New schema ref created
  });

  it("should handle validation of query parameters with schema caching", () => {
    const querySchema = z.object({
      page: z.string(),
      limit: z.string(),
    });

    const req1 = new Request();
    req1.query = { page: "1", limit: "10" };

    const req2 = new Request();
    req2.query = { page: "2", limit: "20" };

    const initialRefCount = getSchemaRefCount();
    const result1 = req1.validateQuery(querySchema);
    const afterFirstCount = getSchemaRefCount();

    expect(result1).toEqual({ page: "1", limit: "10" });
    expect(afterFirstCount).toBe(initialRefCount + 1);

    const result2 = req2.validateQuery(querySchema);
    const afterSecondCount = getSchemaRefCount();

    expect(result2).toEqual({ page: "2", limit: "20" });
    expect(afterSecondCount).toBe(afterFirstCount); // Reused schema
  });

  it("should handle mixed validation types with same schema", () => {
    const schema = z.object({
      value: z.string(),
    });

    const req1 = new Request();
    req1.body = { value: "body-value" };

    const req2 = new Request();
    req2.query = { value: "query-value" };

    const initialRefCount = getSchemaRefCount();
    const result1 = req1.validate(schema);
    const afterBodyCount = getSchemaRefCount();

    expect(result1).toEqual({ value: "body-value" });
    expect(afterBodyCount).toBe(initialRefCount + 1);

    const result2 = req2.validateQuery(schema);
    const afterQueryCount = getSchemaRefCount();

    expect(result2).toEqual({ value: "query-value" });
    expect(afterQueryCount).toBe(afterBodyCount); // Reused same schema
  });

  it("should track openapiSchemaMap size correctly", () => {
    const schema1 = z.object({ a: z.string() });
    const schema2 = z.object({ b: z.number() });
    const schema3 = Type.Object({ c: Type.Boolean() });

    expect(openapiSchemaMap.size).toBe(0);

    const req1 = new Request();
    req1.body = { a: "test" };
    req1.validate(schema1);
    expect(openapiSchemaMap.size).toBe(1);

    const req2 = new Request();
    req2.body = { a: "another" };
    req2.validate(schema1);
    expect(openapiSchemaMap.size).toBe(1); // Reused

    const req3 = new Request();
    req3.body = { b: 42 };
    req3.validate(schema2);
    expect(openapiSchemaMap.size).toBe(2); // New schema

    const req4 = new Request();
    req4.body = { c: true };
    req4.validate(schema3);
    expect(openapiSchemaMap.size).toBe(3); // New schema
  });

  it("should create separate cache entries for different object instances", () => {
    // Create two schemas with same structure but different object instances
    const schema1 = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const schema2 = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const req1 = new Request();
    req1.body = { name: "Alice", age: 30 };

    const req2 = new Request();
    req2.body = { name: "Bob", age: 25 };

    const initialSize = openapiSchemaMap.size;

    // Validate with first schema
    const result1 = req1.validate(schema1);
    expect(result1).toEqual({ name: "Alice", age: 30 });
    const afterFirstValidation = openapiSchemaMap.size;
    expect(afterFirstValidation).toBe(initialSize + 1);

    // Validate with second schema (different object instance)
    const result2 = req2.validate(schema2);
    expect(result2).toEqual({ name: "Bob", age: 25 });
    const afterSecondValidation = openapiSchemaMap.size;

    // Different object instances get different cache entries (WeakMap is identity-based)
    expect(afterSecondValidation).toBe(afterFirstValidation + 1);
  });

  it("should reuse cache when same schema object is used multiple times", () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            profile: { type: "string" },
            settings: { type: "object" },
          },
        },
        metadata: { type: "object" },
      },
    };

    const req1 = new Request();
    req1.body = { user: { profile: "test", settings: {} }, metadata: {} };

    const req2 = new Request();
    req2.body = { metadata: {}, user: { settings: {}, profile: "test2" } };

    const initialSize = openapiSchemaMap.size;
    req1.validate(schema); // Same object reference
    const afterFirst = openapiSchemaMap.size;
    expect(afterFirst).toBe(initialSize + 1);

    req2.validate(schema); // Same object reference reused
    const afterSecond = openapiSchemaMap.size;
    expect(afterSecond).toBe(afterFirst); // Should reuse cache (same object identity)
  });
});
