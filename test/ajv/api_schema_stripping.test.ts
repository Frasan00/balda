import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Type } from "@sinclair/typebox";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { Router } from "../../src/server/router/router.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

describe("API Response Schema Stripping", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    AjvStateManager.clearAllCaches();
  });

  describe("JSON Schema responses", () => {
    it("should strip non-schema properties from response body", async () => {
      router.get(
        "/users/:id",
        {
          responses: {
            200: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
        async (_req, res) => {
          res.ok({
            id: 1,
            name: "Alice",
            email: "alice@example.com",
            passwordHash: "$2b$10$secrethash",
            role: "admin",
            internalNotes: "VIP customer",
          });
        },
      );

      const found = router.find("GET", "/users/1");
      expect(found).toBeDefined();

      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      });
      expect(body).not.toHaveProperty("passwordHash");
      expect(body).not.toHaveProperty("role");
      expect(body).not.toHaveProperty("internalNotes");
    });

    it("should strip nested non-schema properties", async () => {
      router.get(
        "/teams/:id",
        {
          responses: {
            200: {
              type: "object",
              properties: {
                name: { type: "string" },
                leader: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    displayName: { type: "string" },
                  },
                },
              },
            },
          },
        },
        async (_req, res) => {
          res.ok({
            name: "Engineering",
            leader: {
              id: 1,
              displayName: "Alice",
              apiKey: "sk-secret",
              salary: 150000,
            },
            _metadata: { createdBy: "system" },
          });
        },
      );

      const found = router.find("GET", "/teams/1");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({
        name: "Engineering",
        leader: { id: 1, displayName: "Alice" },
      });
      expect(body.leader).not.toHaveProperty("apiKey");
      expect(body.leader).not.toHaveProperty("salary");
      expect(body).not.toHaveProperty("_metadata");
    });

    it("should strip extra properties from array item responses", async () => {
      router.get(
        "/users",
        {
          responses: {
            200: {
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
            },
          },
        },
        async (_req, res) => {
          res.ok({
            users: [
              { id: 1, name: "Alice", password: "secret", ssn: "123-45-6789" },
              { id: 2, name: "Bob", token: "jwt-xxx" },
            ],
            totalCount: 100,
          });
        },
      );

      const found = router.find("GET", "/users");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      });
      expect(body.users[0]).not.toHaveProperty("password");
      expect(body.users[0]).not.toHaveProperty("ssn");
      expect(body.users[1]).not.toHaveProperty("token");
      expect(body).not.toHaveProperty("totalCount");
    });

    it("should strip properties for error responses", async () => {
      router.get(
        "/items/:id",
        {
          responses: {
            200: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
            },
            404: {
              type: "object",
              properties: {
                error: { type: "string" },
              },
            },
          },
        },
        async (_req, res) => {
          res.notFound({
            error: "Item not found",
            stack: "Error: Item not found\n    at ...",
            internalCode: "ITEM_NF_001",
          });
        },
      );

      const found = router.find("GET", "/items/999");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(res.responseStatus).toBe(404);
      expect(body).toEqual({ error: "Item not found" });
      expect(body).not.toHaveProperty("stack");
      expect(body).not.toHaveProperty("internalCode");
    });
  });

  describe("Zod schema responses", () => {
    it("should strip non-schema properties with Zod schemas", async () => {
      const UserResponse = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      });

      router.get(
        "/zod-users/:id",
        {
          responses: { 200: UserResponse },
        },
        async (_req, res) => {
          res.ok({
            id: 1,
            name: "Alice",
            email: "alice@example.com",
            passwordHash: "$2b$10$xxx",
            refreshToken: "rt-xxx",
          });
        },
      );

      const found = router.find("GET", "/zod-users/1");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      });
      expect(body).not.toHaveProperty("passwordHash");
      expect(body).not.toHaveProperty("refreshToken");
    });

    it("should strip nested properties with Zod schemas", async () => {
      const ProfileResponse = z.object({
        user: z.object({
          name: z.string(),
          bio: z.string(),
        }),
      });

      router.get(
        "/zod-profile",
        {
          responses: { 200: ProfileResponse },
        },
        async (_req, res) => {
          res.ok({
            user: {
              name: "Alice",
              bio: "Developer",
              hashedPassword: "xxx",
              loginCount: 42,
            },
            _debug: { queryTime: "12ms" },
          });
        },
      );

      const found = router.find("GET", "/zod-profile");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({
        user: { name: "Alice", bio: "Developer" },
      });
      expect(body.user).not.toHaveProperty("hashedPassword");
      expect(body.user).not.toHaveProperty("loginCount");
      expect(body).not.toHaveProperty("_debug");
    });
  });

  describe("TypeBox schema responses", () => {
    it("should strip non-schema properties with TypeBox schemas", async () => {
      const UserResponse = Type.Object({
        id: Type.Number(),
        name: Type.String(),
      });

      router.get(
        "/typebox-users/:id",
        {
          responses: { 200: UserResponse },
        },
        async (_req, res) => {
          res.ok({
            id: 1,
            name: "Alice",
            secret: "should-not-appear",
            isAdmin: true,
          });
        },
      );

      const found = router.find("GET", "/typebox-users/1");
      const req = new Request();
      const res = new Response();
      res.setRouteResponseSchemas(found!.responseSchemas);

      await found!.handler(req, res);

      const body = JSON.parse(res.getBody());
      expect(body).toEqual({ id: 1, name: "Alice" });
      expect(body).not.toHaveProperty("secret");
      expect(body).not.toHaveProperty("isAdmin");
    });
  });

  describe("Caching behavior", () => {
    it("should return same serializer on repeated calls (cache hit)", () => {
      const schema = {
        type: "object",
        properties: {
          id: { type: "number" },
        },
      } as const;

      const s1 = AjvStateManager.getOrCreateSerializer(
        schema,
        "cache_test",
      );
      const s2 = AjvStateManager.getOrCreateSerializer(
        schema,
        "cache_test",
      );

      expect(s1).toBe(s2);
    });

    it("should produce identical stripping from cached serializer", async () => {
      router.get(
        "/cached",
        {
          responses: {
            200: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
            },
          },
        },
        async (_req, res) => {
          res.ok({ id: 1, name: "Alice", secret: "leaked" });
        },
      );

      const found = router.find("GET", "/cached");

      // First request
      const req1 = new Request();
      const res1 = new Response();
      res1.setRouteResponseSchemas(found!.responseSchemas);
      await found!.handler(req1, res1);
      const body1 = JSON.parse(res1.getBody());

      // Second request (should use cached serializer)
      const req2 = new Request();
      const res2 = new Response();
      res2.setRouteResponseSchemas(found!.responseSchemas);
      await found!.handler(req2, res2);
      const body2 = JSON.parse(res2.getBody());

      expect(body1).toEqual({ id: 1, name: "Alice" });
      expect(body2).toEqual({ id: 1, name: "Alice" });
      expect(body1).not.toHaveProperty("secret");
      expect(body2).not.toHaveProperty("secret");
    });

    it("should strip properties consistently after cache clear", () => {
      const schema = {
        type: "object",
        properties: {
          id: { type: "number" },
        },
      } as const;

      const input = { id: 1, extra: "leaked" };

      // First serializer
      const s1 = AjvStateManager.getOrCreateSerializer(schema, "clear_test");
      expect(JSON.parse(s1!(input))).toEqual({ id: 1 });

      // Clear caches
      AjvStateManager.clearAllCaches();

      // Second serializer (recompiled)
      const s2 = AjvStateManager.getOrCreateSerializer(schema, "clear_test");
      expect(s2).not.toBe(s1);
      expect(JSON.parse(s2!(input))).toEqual({ id: 1 });
    });
  });
});
