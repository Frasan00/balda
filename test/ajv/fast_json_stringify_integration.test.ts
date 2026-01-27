import { Type } from "@sinclair/typebox";
import { beforeEach, describe, expect, it } from "vitest";
import z from "zod";
import {
  clearSerializerCache,
  getSerializerCacheStats,
} from "../../src/ajv/fast_json_stringify_cache.js";
import { controller } from "../../src/decorators/controller/controller.js";
import { get } from "../../src/decorators/handlers/get.js";
import { serialize } from "../../src/decorators/serialize/serialize.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { mockServer } from "../server/instance.js";

describe("@serialize decorator with fast-json-stringify", () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearSerializerCache();
  });

  describe("Zod schema serialization", () => {
    it("should serialize response using fast-json-stringify when Zod schema is provided", async () => {
      @controller("/test-fast-json-zod")
      class TestController {
        @get("/")
        @serialize(z.object({ name: z.string(), age: z.number() }))
        async handler(_req: Request, res: Response) {
          res.json({ name: "John", age: 30 });
        }
      }

      const res = await mockServer.get("/test-fast-json-zod/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({ name: "John", age: 30 });
    });

    it("should serialize arrays with Zod schema", async () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      @controller("/test-fast-json-array")
      class TestController {
        @get("/")
        @serialize(z.array(UserSchema))
        async handler(_req: Request, res: Response) {
          res.json([
            { id: 1, name: "John" },
            { id: 2, name: "Jane" },
          ]);
        }
      }

      const res = await mockServer.get("/test-fast-json-array/");
      expect(res.statusCode()).toBe(200);
      expect(Array.isArray(res.body())).toBe(true);
      expect(res.body()).toHaveLength(2);
      expect(res.body()[0]).toEqual({ id: 1, name: "John" });
    });

    it("should handle nested Zod schemas", async () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
      });

      const UserSchema = z.object({
        name: z.string(),
        address: AddressSchema,
      });

      @controller("/test-fast-json-nested")
      class TestController {
        @get("/")
        @serialize(UserSchema)
        async handler(_req: Request, res: Response) {
          res.json({
            name: "John",
            address: {
              street: "123 Main St",
              city: "New York",
            },
          });
        }
      }

      const res = await mockServer.get("/test-fast-json-nested/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({
        name: "John",
        address: {
          street: "123 Main St",
          city: "New York",
        },
      });
    });

    it("should validate and fail when response doesn't match Zod schema", async () => {
      @controller("/test-fast-json-validation-zod")
      class TestController {
        @get("/")
        @serialize(z.object({ name: z.string(), age: z.number() }), {
          safe: false,
        })
        async handler(_req: Request, res: Response) {
          // Missing required 'age' field
          res.json({ name: "John" });
        }
      }

      const res = await mockServer.get("/test-fast-json-validation-zod/");
      expect(res.statusCode()).toBe(500);
    });
  });

  describe("TypeBox schema serialization", () => {
    it("should serialize response using fast-json-stringify when TypeBox schema is provided", async () => {
      @controller("/test-fast-json-typebox")
      class TestController {
        @get("/")
        @serialize(
          Type.Object({
            name: Type.String(),
            age: Type.Number(),
          }),
        )
        async handler(_req: Request, res: Response) {
          res.json({ name: "Jane", age: 25 });
        }
      }

      const res = await mockServer.get("/test-fast-json-typebox/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({ name: "Jane", age: 25 });
    });

    it("should serialize arrays with TypeBox schema", async () => {
      const ProductSchema = Type.Object({
        id: Type.Number(),
        title: Type.String(),
        price: Type.Number(),
      });

      @controller("/test-fast-json-typebox-array")
      class TestController {
        @get("/")
        @serialize(Type.Array(ProductSchema))
        async handler(_req: Request, res: Response) {
          res.json([
            { id: 1, title: "Book", price: 10 },
            { id: 2, title: "Pen", price: 5 },
          ]);
        }
      }

      const res = await mockServer.get("/test-fast-json-typebox-array/");
      expect(res.statusCode()).toBe(200);
      expect(Array.isArray(res.body())).toBe(true);
      expect(res.body()).toHaveLength(2);
      expect(res.body()[0]).toEqual({ id: 1, title: "Book", price: 10 });
    });

    it("should validate and fail when response doesn't match TypeBox schema", async () => {
      @controller("/test-fast-json-validation-typebox")
      class TestController {
        @get("/")
        @serialize(
          Type.Object({
            name: Type.String(),
            age: Type.Number(),
          }),
          { safe: false },
        )
        async handler(_req: Request, res: Response) {
          // Missing required 'age' field
          res.json({ name: "Jane" });
        }
      }

      const res = await mockServer.get("/test-fast-json-validation-typebox/");
      expect(res.statusCode()).toBe(500);
    });
  });

  describe("Plain JSON schema serialization", () => {
    it("should serialize response using fast-json-stringify when plain JSON schema is provided", async () => {
      const JsonSchema = {
        type: "object" as const,
        properties: {
          email: { type: "string" as const, format: "email" as const },
          active: { type: "boolean" as const },
        },
        required: ["email", "active"],
        additionalProperties: false,
      };

      @controller("/test-fast-json-plain")
      class TestController {
        @get("/")
        @serialize(JsonSchema)
        async handler(_req: Request, res: Response) {
          res.json({ email: "test@example.com", active: true });
        }
      }

      const res = await mockServer.get("/test-fast-json-plain/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({ email: "test@example.com", active: true });
    });

    it("should validate and fail when response doesn't match plain JSON schema", async () => {
      const JsonSchema = {
        type: "object" as const,
        properties: {
          value: { type: "number" as const },
        },
        required: ["value"],
        additionalProperties: false,
      };

      @controller("/test-fast-json-validation-plain")
      class TestController {
        @get("/")
        @serialize(JsonSchema, { safe: false })
        async handler(_req: Request, res: Response) {
          // Invalid type: string instead of number
          res.json({ value: "not-a-number" });
        }
      }

      const res = await mockServer.get("/test-fast-json-validation-plain/");
      expect(res.statusCode()).toBe(500);
    });
  });

  describe("cache behavior", () => {
    it("should reuse cached serializer across multiple requests with same schema", async () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      @controller("/test-fast-json-cache")
      class TestController {
        @get("/1")
        @serialize(UserSchema)
        async handler1(_req: Request, res: Response) {
          res.json({ id: 1, name: "John" });
        }

        @get("/2")
        @serialize(UserSchema)
        async handler2(_req: Request, res: Response) {
          res.json({ id: 2, name: "Jane" });
        }
      }

      // First request
      const res1 = await mockServer.get("/test-fast-json-cache/1");
      expect(res1.statusCode()).toBe(200);

      // Second request with same schema
      const res2 = await mockServer.get("/test-fast-json-cache/2");
      expect(res2.statusCode()).toBe(200);
    });

    it("should populate cache when validation runs (safe: false)", async () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      @controller("/test-fast-json-cache-unsafe")
      class TestController {
        @get("/")
        @serialize(UserSchema, { safe: false })
        async handler(_req: Request, res: Response) {
          res.json({ id: 1, name: "John" });
        }
      }

      // After controller registration, cache should have 1 entry (eager compilation)
      const statsBefore = getSerializerCacheStats();
      expect(statsBefore.size).toBe(1);

      // First request with safe: false uses the pre-compiled serializer
      const res1 = await mockServer.get("/test-fast-json-cache-unsafe/");
      expect(res1.statusCode()).toBe(200);

      const statsAfterFirst = getSerializerCacheStats();
      // Cache size should remain 1 (no new compilation)
      expect(statsAfterFirst.size).toBe(1);

      // Second request should reuse the same cache entry
      const res2 = await mockServer.get("/test-fast-json-cache-unsafe/");
      expect(res2.statusCode()).toBe(200);

      const statsAfterSecond = getSerializerCacheStats();
      // No new cache entry should be created
      expect(statsAfterSecond.size).toBe(1);
    });

    it("should populate cache in safe mode (default) for fast serialization", async () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      @controller("/test-fast-json-cache-safe-mode")
      class TestController {
        @get("/")
        @serialize(UserSchema) // safe: true is the default
        async handler(_req: Request, res: Response) {
          res.json({ id: 1, name: "John" });
        }
      }

      // After controller registration, cache should have 1 entry (eager compilation)
      const statsBefore = getSerializerCacheStats();
      expect(statsBefore.size).toBe(1);

      // First request with safe mode uses the pre-compiled serializer
      const res1 = await mockServer.get("/test-fast-json-cache-safe-mode/");
      expect(res1.statusCode()).toBe(200);
      expect(res1.body()).toEqual({ id: 1, name: "John" });

      const statsAfterFirst = getSerializerCacheStats();
      // Cache size should remain 1 (no new compilation)
      expect(statsAfterFirst.size).toBe(1);

      // Second request should reuse the cached serializer
      const res2 = await mockServer.get("/test-fast-json-cache-safe-mode/");
      expect(res2.statusCode()).toBe(200);

      const statsAfterSecond = getSerializerCacheStats();
      // No new cache entry should be created
      expect(statsAfterSecond.size).toBe(1);
    });

    it("should create separate cache entries for different schemas", async () => {
      @controller("/test-fast-json-multi-cache")
      class TestController {
        @get("/zod")
        @serialize(z.object({ name: z.string() }))
        async handlerZod(_req: Request, res: Response) {
          res.json({ name: "Zod" });
        }

        @get("/typebox")
        @serialize(Type.Object({ value: Type.Number() }))
        async handlerTypeBox(_req: Request, res: Response) {
          res.json({ value: 42 });
        }

        @get("/plain")
        @serialize({
          type: "object" as const,
          properties: {
            email: { type: "string" as const },
          },
          required: ["email"],
        })
        async handlerPlain(_req: Request, res: Response) {
          res.json({ email: "test@example.com" });
        }
      }

      // Make requests with different schemas
      await mockServer.get("/test-fast-json-multi-cache/zod");
      await mockServer.get("/test-fast-json-multi-cache/typebox");
      await mockServer.get("/test-fast-json-multi-cache/plain");
    });
  });

  describe("fallback behavior", () => {
    it("should fallback to JSON.stringify when no schema is provided", async () => {
      @controller("/test-fast-json-fallback")
      class TestController {
        @get("/")
        async handler(_req: Request, res: Response) {
          // No @serialize decorator - should use standard JSON.stringify
          res.json({ name: "John", age: 30 });
        }
      }

      const res = await mockServer.get("/test-fast-json-fallback/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({ name: "John", age: 30 });

      // No serializer should be cached
      const stats = getSerializerCacheStats();
      expect(stats.size).toBe(0);
    });

    it("should handle safe mode validation failures gracefully", async () => {
      @controller("/test-fast-json-safe")
      class TestController {
        @get("/")
        @serialize(z.object({ name: z.string(), age: z.number() }), {
          safe: true,
        })
        async handler(_req: Request, res: Response) {
          // Missing 'age' field, but safe mode should return the response anyway
          res.json({ name: "John" });
        }
      }

      const res = await mockServer.get("/test-fast-json-safe/");
      // In safe mode, validation errors don't cause 500
      expect(res.statusCode()).toBe(200);
    });
  });

  describe("special response scenarios", () => {
    it("should handle empty responses", async () => {
      @controller("/test-fast-json-empty")
      class TestController {
        @get("/")
        @serialize(z.object({ name: z.string() }))
        async handler(_req: Request, res: Response) {
          res.noContent();
        }
      }

      const res = await mockServer.get("/test-fast-json-empty/");
      expect(res.statusCode()).toBe(204);
    });

    it("should handle different status codes with @serialize", async () => {
      @controller("/test-fast-json-status")
      class TestController {
        @get("/created")
        @serialize(z.object({ id: z.number() }), { status: 201 })
        async handlerCreated(_req: Request, res: Response) {
          return res.created({ id: 1 });
        }

        @get("/not-found")
        @serialize(z.object({ error: z.literal("Not found") }), {
          status: 404,
        })
        async handlerNotFound(_req: Request, res: Response) {
          return res.notFound({ error: "Not found" });
        }
      }

      const res1 = await mockServer.get("/test-fast-json-status/created");
      expect(res1.statusCode()).toBe(201);
      expect(res1.body()).toEqual({ id: 1 });

      const res2 = await mockServer.get("/test-fast-json-status/not-found");
      expect(res2.statusCode()).toBe(404);
      expect(res2.body()).toEqual({ error: "Not found" });
    });

    it("should handle null values in responses", async () => {
      @controller("/test-fast-json-null")
      class TestController {
        @get("/")
        @serialize(
          z.object({
            name: z.string(),
            optional: z.string().nullable(),
          }),
        )
        async handler(_req: Request, res: Response) {
          res.json({ name: "John", optional: null });
        }
      }

      const res = await mockServer.get("/test-fast-json-null/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual({ name: "John", optional: null });
    });
  });

  describe("performance and correctness", () => {
    it("should produce identical output to JSON.stringify", async () => {
      const complexData = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        active: true,
        balance: 100.5,
        tags: ["user", "premium"],
        metadata: {
          created: "2024-01-01",
          updated: "2024-01-15",
        },
      };

      @controller("/test-fast-json-correctness")
      class TestController {
        @get("/")
        @serialize(
          z.object({
            id: z.number(),
            name: z.string(),
            email: z.string().email(),
            active: z.boolean(),
            balance: z.number(),
            tags: z.array(z.string()),
            metadata: z.object({
              created: z.string(),
              updated: z.string(),
            }),
          }),
        )
        async handler(_req: Request, res: Response) {
          res.json(complexData);
        }
      }

      const res = await mockServer.get("/test-fast-json-correctness/");
      expect(res.statusCode()).toBe(200);

      // Output should be valid JSON and match the input
      const body = res.body();
      expect(body).toEqual(complexData);

      // Should be parseable as JSON
      expect(() => JSON.parse(JSON.stringify(body))).not.toThrow();
    });

    it("should handle special characters correctly", async () => {
      const specialData = {
        message: 'Hello "World"\nNew line\tTab',
        emoji: "🚀",
        unicode: "こんにちは",
      };

      @controller("/test-fast-json-special")
      class TestController {
        @get("/")
        @serialize(
          z.object({
            message: z.string(),
            emoji: z.string(),
            unicode: z.string(),
          }),
        )
        async handler(_req: Request, res: Response) {
          res.json(specialData);
        }
      }

      const res = await mockServer.get("/test-fast-json-special/");
      expect(res.statusCode()).toBe(200);
      expect(res.body()).toEqual(specialData);
    });
  });
});
