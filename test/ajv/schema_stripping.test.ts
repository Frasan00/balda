import { beforeEach, describe, expect, it } from "vitest";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { enforceSchemaStripping } from "../../src/ajv/ajv.js";
import type { JSONSchema } from "../../src/plugins/swagger/swagger_types.js";

describe("Response Schema Stripping", () => {
  beforeEach(() => {
    AjvStateManager.clearAllCaches();
  });

  describe("enforceSchemaStripping", () => {
    it("should set additionalProperties to false on root object schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const result = enforceSchemaStripping(schema);

      expect(result).not.toBe(schema);
      expect(result.additionalProperties).toBe(false);
      expect(schema.additionalProperties).toBeUndefined();
    });

    it("should override additionalProperties: true", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        additionalProperties: true,
      };

      const result = enforceSchemaStripping(schema);

      expect(result.additionalProperties).toBe(false);
    });

    it("should set additionalProperties: false on nested object schemas", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      };

      const result = enforceSchemaStripping(schema);

      expect(result.additionalProperties).toBe(false);
      expect((result.properties as any).user.additionalProperties).toBe(false);
    });

    it("should handle array items with object schemas", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const result = enforceSchemaStripping(schema);

      const usersItems = (result.properties as any).users.items;
      expect(usersItems.additionalProperties).toBe(false);
    });

    it("should skip $ref nodes", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          linked: { $ref: "#/$defs/LinkedItem" },
          name: { type: "string" },
        },
        $defs: {
          LinkedItem: {
            type: "object",
            properties: {
              id: { type: "number" },
            },
          },
        },
      };

      const result = enforceSchemaStripping(schema);

      // $ref property is untouched
      expect((result.properties as any).linked).toEqual({
        $ref: "#/$defs/LinkedItem",
      });
      // But $defs definitions get stripped
      expect((result as any).$defs.LinkedItem.additionalProperties).toBe(false);
    });

    it("should handle oneOf / anyOf / allOf", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          value: {
            oneOf: [
              {
                type: "object",
                properties: { a: { type: "string" } },
              },
              {
                type: "object",
                properties: { b: { type: "number" } },
              },
            ],
          } as any,
        },
      };

      const result = enforceSchemaStripping(schema);

      const oneOf = (result.properties as any).value.oneOf;
      expect(oneOf[0].additionalProperties).toBe(false);
      expect(oneOf[1].additionalProperties).toBe(false);
    });

    it("should not mutate the original schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
          },
        },
      };

      const original = JSON.parse(JSON.stringify(schema));
      enforceSchemaStripping(schema);

      expect(schema).toEqual(original);
    });

    it("should return the same reference for schemas without properties", () => {
      const schema: JSONSchema = { type: "string" };
      const result = enforceSchemaStripping(schema);
      expect(result).toBe(schema);
    });
  });

  describe("Serializer strips non-schema properties", () => {
    it("should not include extra properties in serialized output", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      };

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip",
      );
      expect(serializer).not.toBeNull();

      const input = {
        id: 1,
        name: "Alice",
        password: "secret123",
        role: "admin",
      };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({ id: 1, name: "Alice" });
      expect(output).not.toHaveProperty("password");
      expect(output).not.toHaveProperty("role");
    });

    it("should strip nested non-schema properties", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      };

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip_nested",
      );
      expect(serializer).not.toBeNull();

      const input = {
        user: {
          name: "Alice",
          email: "alice@example.com",
          passwordHash: "$2b$10$...",
          internalId: "uuid-xxx",
        },
        _metadata: { source: "db" },
      };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({
        user: { name: "Alice", email: "alice@example.com" },
      });
      expect(output.user).not.toHaveProperty("passwordHash");
      expect(output.user).not.toHaveProperty("internalId");
      expect(output).not.toHaveProperty("_metadata");
    });

    it("should strip extra properties from array items", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip_array",
      );
      expect(serializer).not.toBeNull();

      const input = {
        users: [
          { id: 1, name: "Alice", password: "secret", isAdmin: true },
          { id: 2, name: "Bob", ssn: "123-45-6789" },
        ],
        totalCount: 100,
      };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      });
      expect(output.users[0]).not.toHaveProperty("password");
      expect(output.users[0]).not.toHaveProperty("isAdmin");
      expect(output.users[1]).not.toHaveProperty("ssn");
      expect(output).not.toHaveProperty("totalCount");
    });

    it("should strip extra properties even when schema had additionalProperties: true", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: true,
      };

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip_override",
      );
      expect(serializer).not.toBeNull();

      const input = { name: "Alice", secret: "leaked" };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({ name: "Alice" });
      expect(output).not.toHaveProperty("secret");
    });

    it("should strip deeply nested extra properties", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
      };

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip_deep",
      );
      expect(serializer).not.toBeNull();

      const input = {
        data: {
          profile: {
            displayName: "Alice",
            apiKey: "sk-xxx",
          },
          _internal: true,
        },
        debug: { trace: true },
      };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({
        data: { profile: { displayName: "Alice" } },
      });
      expect(output.data.profile).not.toHaveProperty("apiKey");
      expect(output.data).not.toHaveProperty("_internal");
      expect(output).not.toHaveProperty("debug");
    });

    it("should work with TypeBox-style schemas", () => {
      const schema = {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        [Symbol.for("TypeBox.Kind")]: "Object",
      } as unknown as JSONSchema;

      const serializer = AjvStateManager.getOrCreateSerializer(
        schema,
        "test_strip_typebox",
      );
      expect(serializer).not.toBeNull();

      const input = { message: "hello", token: "jwt-xxx" };
      const output = JSON.parse(serializer!(input));

      expect(output).toEqual({ message: "hello" });
      expect(output).not.toHaveProperty("token");
    });

    it("should return only schema-defined properties via route response serializers", () => {
      const schemas = {
        200: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        } as JSONSchema,
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        } as JSONSchema,
      };

      const serializers =
        AjvStateManager.getOrCreateResponseSerializers(schemas);
      expect(serializers).not.toBeNull();

      // 200 response
      const ok = serializers!.get(200)!;
      const okOutput = JSON.parse(
        ok({ id: 1, name: "Alice", password: "secret", role: "admin" }),
      );
      expect(okOutput).toEqual({ id: 1, name: "Alice" });
      expect(okOutput).not.toHaveProperty("password");
      expect(okOutput).not.toHaveProperty("role");

      // 404 response
      const notFound = serializers!.get(404)!;
      const nfOutput = JSON.parse(
        notFound({ error: "Not found", stack: "Error: ...", code: "NF01" }),
      );
      expect(nfOutput).toEqual({ error: "Not found" });
      expect(nfOutput).not.toHaveProperty("stack");
      expect(nfOutput).not.toHaveProperty("code");
    });
  });
});
