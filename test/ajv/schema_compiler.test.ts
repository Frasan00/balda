import { beforeEach, describe, expect, it } from "vitest";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import {
  compileAndCacheValidator,
  compileRequestSchemas,
  compileRequestValidator,
  compileResponseSchemas,
} from "../../src/ajv/schema_compiler.js";

describe("Schema Compiler - Shared Utility", () => {
  beforeEach(() => {
    // Clear Ajv caches before each test
    AjvStateManager.clearAllCaches();
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

      // Verify schema was stored in Ajv
      const validator = AjvStateManager.getJsonSchema(schema, "serialize_json");
      expect(validator).toBeDefined();
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

      // Verify schema was stored in Ajv
      const validator = AjvStateManager.getJsonSchema(
        schema,
        "serialize_typebox",
      );
      expect(validator).toBeDefined();
    });

    it("should not crash on invalid schemas", () => {
      const invalidSchema = null as any;

      expect(() => compileAndCacheValidator(invalidSchema)).not.toThrow();
    });
  });

  describe("compileRequestValidator", () => {
    it("should compile and cache a request JSON schema validator", () => {
      const schema = {
        type: "object",
        properties: {
          email: { type: "string" },
        },
        required: ["email"],
      } as const;

      compileRequestValidator(schema);

      // Verify schema was stored in Ajv
      const validator = AjvStateManager.getJsonSchema(schema, "json_schema");
      expect(validator).toBeDefined();
    });

    it("should compile and cache a TypeBox schema validator for requests", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        [Symbol.for("TypeBox.Kind")]: "Object",
      } as const;

      compileRequestValidator(schema);

      // Verify schema was stored in Ajv
      const validator = AjvStateManager.getJsonSchema(schema, "typebox_schema");
      expect(validator).toBeDefined();
    });
  });

  describe("compileRequestSchemas", () => {
    it("should compile both body and query schemas", () => {
      const bodySchema = {
        type: "object",
        properties: {
          username: { type: "string" },
        },
      } as const;

      const querySchema = {
        type: "object",
        properties: {
          page: { type: "number" },
        },
      } as const;

      compileRequestSchemas(bodySchema, querySchema);

      // Both should be cached in Ajv
      const bodyValidator = AjvStateManager.getJsonSchema(
        bodySchema,
        "json_schema",
      );
      const queryValidator = AjvStateManager.getJsonSchema(
        querySchema,
        "json_schema",
      );

      expect(bodyValidator).toBeDefined();
      expect(queryValidator).toBeDefined();
    });

    it("should handle undefined schemas gracefully", () => {
      expect(() => compileRequestSchemas(undefined, undefined)).not.toThrow();
    });
  });

  describe("compileResponseSchemas", () => {
    it("should compile response schemas for multiple status codes", () => {
      const responses = {
        200: {
          type: "object",
          properties: {
            data: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      } as const;

      const result = compileResponseSchemas(responses);

      expect(result).toBeDefined();
      expect(result?.[200]).toBe(responses[200]);
      expect(result?.[404]).toBe(responses[404]);

      // Verify schemas were cached in Ajv
      const schema200 = AjvStateManager.getJsonSchema(
        responses[200],
        "serialize_json",
      );
      const schema404 = AjvStateManager.getJsonSchema(
        responses[404],
        "serialize_json",
      );

      expect(schema200).toBeDefined();
      expect(schema404).toBeDefined();
    });

    it("should return undefined for empty responses", () => {
      const result = compileResponseSchemas({});
      expect(result).toBeUndefined();
    });

    it("should return undefined for undefined responses", () => {
      const result = compileResponseSchemas(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle TypeBox schemas in responses", () => {
      const schema = {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        [Symbol.for("TypeBox.Kind")]: "Object",
      } as const;

      const responses = {
        200: schema,
      };

      const result = compileResponseSchemas(responses);

      expect(result).toBeDefined();
      expect(result?.[200]).toBe(schema);

      // Verify schema was cached
      const cachedSchema = AjvStateManager.getJsonSchema(
        schema,
        "serialize_typebox",
      );
      expect(cachedSchema).toBeDefined();
    });
  });
});
