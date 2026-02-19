import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Type } from "@sinclair/typebox";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { Router } from "../../src/server/router/router.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

describe("Router - Inline Validation with Parameter Injection", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    AjvStateManager.clearAllCaches();
  });

  describe("Body Validation", () => {
    it("should validate body and inject as third parameter", async () => {
      const bodySchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      let capturedBody: any = null;

      router.post(
        "/users",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ success: true });
        },
      );

      const found = router.find("POST", "/users");
      expect(found).toBeDefined();

      const req = new Request();
      req.body = { name: "John", age: 30 };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ name: "John", age: 30 });
    });

    it("should return 400 for invalid body data", async () => {
      const bodySchema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      router.post(
        "/users",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          res.json({ data: validatedBody });
        },
      );

      const found = router.find("POST", "/users");
      const req = new Request();
      req.body = { email: "invalid-email", age: 15 };
      const res = new Response();

      await found!.handler(req, res);

      expect(res.responseStatus).toBe(400);
    });

    it("should work with TypeBox schemas", async () => {
      const bodySchema = Type.Object({
        title: Type.String(),
        price: Type.Number({ minimum: 0 }),
      });

      let capturedBody: any = null;

      router.post(
        "/products",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ success: true });
        },
      );

      const found = router.find("POST", "/products");
      const req = new Request();
      req.body = { title: "Book", price: 29.99 };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ title: "Book", price: 29.99 });
    });

    it("should work with plain JSON schemas", async () => {
      const bodySchema = {
        type: "object",
        properties: {
          username: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["username"],
      } as const;

      let capturedBody: any = null;

      router.patch(
        "/settings",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ updated: true });
        },
      );

      const found = router.find("PATCH", "/settings");
      const req = new Request();
      req.body = { username: "alice", active: true };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ username: "alice", active: true });
    });
  });

  describe("Query Validation", () => {
    it("should validate query and inject as third parameter", async () => {
      const querySchema = z.object({
        page: z.coerce.number(),
        limit: z.coerce.number(),
      });

      router.get(
        "/items",
        {
          query: querySchema,
        },
        async (req, res, validatedQuery) => {
          res.json({ page: validatedQuery.page, limit: validatedQuery.limit });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/items");

      // Verify route has validation schemas
      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeDefined();
      expect(route!.validationSchemas!.query).toBe(querySchema);
    });

    it("should return 400 for invalid query data", async () => {
      const querySchema = z.object({
        status: z.enum(["active", "inactive"]),
      });

      router.get(
        "/filter",
        {
          query: querySchema,
        },
        async (req, res, validatedQuery) => {
          res.json({ data: validatedQuery });
        },
      );

      const found = router.find("GET", "/filter");
      const req = new Request();
      req.url = "http://localhost/filter?status=invalid-status";
      req.setQueryString("status=invalid-status");
      const res = new Response();

      await found!.handler(req, res);

      expect(res.responseStatus).toBe(400);
    });
  });

  describe("Body + Query Validation", () => {
    it("should validate and inject both body and query parameters", async () => {
      const bodySchema = z.object({
        content: z.string(),
      });

      const querySchema = z.object({
        format: z.string(),
      });

      let capturedBody: any = null;
      let capturedQuery: any = null;

      router.post(
        "/export",
        {
          body: bodySchema,
          query: querySchema,
        },
        async (req, res, validatedBody, validatedQuery) => {
          capturedBody = validatedBody;
          capturedQuery = validatedQuery;
          res.json({ exported: true });
        },
      );

      const found = router.find("POST", "/export");
      const req = new Request();
      req.body = { content: "test data" };
      req.url = "http://localhost/export?format=json";
      req.setQueryString("format=json");
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ content: "test data" });
      expect(capturedQuery).toEqual({ format: "json" });
    });

    it("should maintain parameter order: req, res, body, query", async () => {
      const bodySchema = z.object({
        field1: z.string(),
      });

      const querySchema = z.object({
        field2: z.string(),
      });

      const paramOrder: string[] = [];

      router.put(
        "/test-order",
        {
          body: bodySchema,
          query: querySchema,
        },
        async (...args: any[]) => {
          paramOrder.push("req: " + (args[0] instanceof Request));
          paramOrder.push("res: " + (args[1] instanceof Response));
          paramOrder.push("body: " + JSON.stringify(args[2]));
          paramOrder.push("query: " + JSON.stringify(args[3]));
          args[1].json({ ok: true });
        },
      );

      const found = router.find("PUT", "/test-order");
      const req = new Request();
      req.body = { field1: "value1" };
      req.url = "http://localhost/test-order?field2=value2";
      req.setQueryString("field2=value2");
      const res = new Response();

      await found!.handler(req, res);

      expect(paramOrder).toEqual([
        "req: true",
        "res: true",
        'body: {"field1":"value1"}',
        'query: {"field2":"value2"}',
      ]);
    });
  });

  describe("All Validation", () => {
    it("should validate both body and query with single schema", async () => {
      const allSchema = z.object({
        id: z.string(),
        value: z.coerce.number(),
      });

      router.post(
        "/combined",
        {
          all: allSchema,
        },
        async (req, res, validatedData) => {
          res.json({ id: validatedData.id, value: validatedData.value });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/combined");

      // Verify route has validation schemas
      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeDefined();
      expect(route!.validationSchemas!.all).toBe(allSchema);
    });
  });

  describe("Validation with Middlewares", () => {
    it("should validate after middleware execution", async () => {
      const bodySchema = z.object({
        text: z.string(),
      });

      let middlewareExecuted = false;
      let validationExecuted = false;

      const testMiddleware = async (req: Request, res: Response, next: any) => {
        middlewareExecuted = true;
        await next();
      };

      router.post(
        "/with-middleware",
        {
          middlewares: [testMiddleware],
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          validationExecuted = true;
          res.json({ text: validatedBody.text });
        },
      );

      const found = router.find("POST", "/with-middleware");
      const req = new Request();
      req.body = { text: "hello" };
      const res = new Response();

      // Execute middleware chain manually for test
      await testMiddleware(req, res, async () => {
        await found!.handler(req, res);
      });

      expect(middlewareExecuted).toBe(true);
      expect(validationExecuted).toBe(true);
    });
  });

  describe("Integration with Swagger", () => {
    it("should store validation schemas in route metadata for Swagger", () => {
      const bodySchema = z.object({
        email: z.string().email(),
      });

      const querySchema = z.object({
        sort: z.enum(["asc", "desc"]),
      });

      router.post(
        "/api/search",
        {
          body: bodySchema,
          query: querySchema,
          responses: {
            200: {
              type: "object",
              properties: { results: { type: "array" } },
            },
          },
          swagger: {
            name: "Search API",
            description: "Search with filters",
          },
        },
        async (req, res, validatedBody, validatedQuery) => {
          res.json({ ok: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/api/search");

      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeDefined();
      expect(route!.validationSchemas!.body).toBe(bodySchema);
      expect(route!.validationSchemas!.query).toBe(querySchema);
      expect(route!.swaggerOptions?.name).toBe("Search API");
    });

    it("should compile schemas for Swagger documentation", () => {
      const bodySchema = {
        type: "object",
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      } as const;

      router.put(
        "/posts/:id",
        {
          body: bodySchema,
          responses: {
            200: {
              type: "object",
              properties: { updated: { type: "boolean" } },
            },
          },
        },
        async (req, res, validatedBody) => {
          res.json({ updated: true });
        },
      );

      // Verify schema was cached for Swagger
      const cached = AjvStateManager.getJsonSchema(bodySchema, "json_schema");
      expect(cached).toBeDefined();
    });
  });

  describe("Dynamic Routes with Validation", () => {
    it("should work with path parameters and body validation", async () => {
      const bodySchema = z.object({
        status: z.string(),
      });

      let capturedParams: any = null;
      let capturedBody: any = null;

      router.patch(
        "/orders/:orderId",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedParams = req.params;
          capturedBody = validatedBody;
          res.json({ updated: true });
        },
      );

      const found = router.find("PATCH", "/orders/order-123");
      expect(found).toBeDefined();

      const req = new Request();
      req.params = found!.params;
      req.body = { status: "completed" };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedParams.orderId).toBe("order-123");
      expect(capturedBody).toEqual({ status: "completed" });
    });

    it("should work with multiple path parameters and query validation", async () => {
      const querySchema = z.object({
        includeComments: z.string(),
        includeAuthor: z.string(),
      });

      let capturedParams: any = null;
      let capturedQuery: any = null;

      router.get(
        "/users/:userId/posts/:postId",
        {
          query: querySchema,
        },
        async (req, res, validatedQuery) => {
          capturedParams = req.params;
          capturedQuery = validatedQuery;
          res.json({ found: true });
        },
      );

      const found = router.find("GET", "/users/user-1/posts/post-2");
      const req = new Request();
      req.params = found!.params;
      req.url =
        "http://localhost/users/user-1/posts/post-2?includeComments=true&includeAuthor=true";
      req.setQueryString("includeComments=true&includeAuthor=true");
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedParams.userId).toBe("user-1");
      expect(capturedParams.postId).toBe("post-2");
      expect(capturedQuery).toEqual({
        includeComments: "true",
        includeAuthor: "true",
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 400 with validation error details on body failure", async () => {
      const bodySchema = z.object({
        count: z.number().positive(),
      });

      router.post(
        "/increment",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          res.json({ count: validatedBody.count });
        },
      );

      const found = router.find("POST", "/increment");
      const req = new Request();
      req.body = { count: -5 };
      const res = new Response();

      await found!.handler(req, res);

      expect(res.responseStatus).toBe(400);
      const body = res.getBody();
      expect(body).toBeDefined();
    });

    it("should return 400 when required body fields are missing", async () => {
      const bodySchema = z.object({
        required1: z.string(),
        required2: z.number(),
      });

      router.post(
        "/strict",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          res.json({ ok: true });
        },
      );

      const found = router.find("POST", "/strict");
      const req = new Request();
      req.body = { required1: "value" }; // missing required2
      const res = new Response();

      await found!.handler(req, res);

      expect(res.responseStatus).toBe(400);
    });

    it("should return 400 when query validation fails", async () => {
      const querySchema = z.object({
        page: z.coerce.number().positive(),
        limit: z.coerce.number().max(100),
      });

      router.get(
        "/list",
        {
          query: querySchema,
        },
        async (req, res, validatedQuery) => {
          res.json({ data: [] });
        },
      );

      const found = router.find("GET", "/list");
      const req = new Request();
      req.url = "http://localhost/list?page=-1&limit=200";
      req.setQueryString("page=-1&limit=200");
      const res = new Response();

      await found!.handler(req, res);

      expect(res.responseStatus).toBe(400);
    });
  });

  describe("Routes Without Validation", () => {
    it("should work normally without validation schemas", async () => {
      let handlerExecuted = false;

      router.get("/no-validation", async (req, res) => {
        handlerExecuted = true;
        res.json({ ok: true });
      });

      const found = router.find("GET", "/no-validation");
      const req = new Request();
      const res = new Response();

      await found!.handler(req, res);

      expect(handlerExecuted).toBe(true);
      expect(res.responseStatus).toBe(200);
    });

    it("should not inject extra parameters when no validation", async () => {
      let argCount = 0;

      router.post("/plain", async (...args: any[]) => {
        argCount = args.length;
        args[1].json({ count: argCount });
      });

      const found = router.find("POST", "/plain");
      const req = new Request();
      const res = new Response();

      await found!.handler(req, res);

      expect(argCount).toBe(2); // Only req and res
    });
  });

  describe("Complex Validation Scenarios", () => {
    it("should handle nested object validation", async () => {
      const bodySchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        metadata: z.object({
          timestamp: z.number(),
        }),
      });

      let capturedBody: any = null;

      router.post(
        "/complex",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ created: true });
        },
      );

      const found = router.find("POST", "/complex");
      const req = new Request();
      req.body = {
        user: {
          name: "Bob",
          email: "bob@example.com",
        },
        metadata: {
          timestamp: Date.now(),
        },
      };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toBeDefined();
      expect(capturedBody.user.name).toBe("Bob");
      expect(capturedBody.user.email).toBe("bob@example.com");
    });

    it("should handle array validation in body", async () => {
      const bodySchema = z.object({
        items: z.array(z.string()),
        tags: z.array(z.number()),
      });

      let capturedBody: any = null;

      router.post(
        "/bulk",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ processed: validatedBody.items.length });
        },
      );

      const found = router.find("POST", "/bulk");
      const req = new Request();
      req.body = {
        items: ["a", "b", "c"],
        tags: [1, 2, 3],
      };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody.items).toEqual(["a", "b", "c"]);
      expect(capturedBody.tags).toEqual([1, 2, 3]);
    });

    it("should handle optional fields correctly", async () => {
      const bodySchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      let capturedBody: any = null;

      router.post(
        "/optional-test",
        {
          body: bodySchema,
        },
        async (req, res, validatedBody) => {
          capturedBody = validatedBody;
          res.json({ ok: true });
        },
      );

      const found = router.find("POST", "/optional-test");
      const req = new Request();
      req.body = { required: "value" }; // optional field not provided
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ required: "value" });
      expect(res.responseStatus).toBe(200);
    });
  });

  describe("Validation Schema Storage", () => {
    it("should store validation schemas in route metadata", () => {
      const bodySchema = z.object({ x: z.number() });
      const querySchema = z.object({ y: z.string() });

      router.post(
        "/metadata-test",
        {
          body: bodySchema,
          query: querySchema,
        },
        async (req, res, body, query) => {
          res.json({ ok: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/metadata-test");

      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeDefined();
      expect(route!.validationSchemas!.body).toBe(bodySchema);
      expect(route!.validationSchemas!.query).toBe(querySchema);
    });

    it("should not store validation schemas when none provided", () => {
      router.get("/no-schemas", async (req, res) => {
        res.json({ ok: true });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/no-schemas");

      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeUndefined();
    });
  });

  describe("Mixed API Styles", () => {
    it("should support both inline validation and manual validation", async () => {
      const inlineSchema = z.object({ a: z.string() });

      let inlineBody: any = null;
      let manualBody: any = null;

      router.post(
        "/inline",
        {
          body: inlineSchema,
        },
        async (req, res, validatedBody) => {
          inlineBody = validatedBody;
          res.json({ ok: true });
        },
      );

      router.post("/manual", async (req, res) => {
        manualBody = req.validate(inlineSchema);
        res.json({ ok: true });
      });

      // Test inline validation
      const foundInline = router.find("POST", "/inline");
      const req1 = new Request();
      req1.body = { a: "test1" };
      const res1 = new Response();
      await foundInline!.handler(req1, res1);

      // Test manual validation
      const foundManual = router.find("POST", "/manual");
      const req2 = new Request();
      req2.body = { a: "test2" };
      const res2 = new Response();
      await foundManual!.handler(req2, res2);

      expect(inlineBody).toEqual({ a: "test1" });
      expect(manualBody).toEqual({ a: "test2" });
    });
  });

  describe("Router Group with Validation", () => {
    it("should support validation in grouped routes", async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      let capturedBody: any = null;

      router.group("/api/v1", (r) => {
        r.post(
          "/items",
          {
            body: bodySchema,
          },
          async (req, res, validatedBody) => {
            capturedBody = validatedBody;
            res.json({ created: true });
          },
        );
      });

      const found = router.find("POST", "/api/v1/items");
      expect(found).toBeDefined();

      const req = new Request();
      req.body = { name: "Item 1" };
      const res = new Response();

      await found!.handler(req, res);

      expect(capturedBody).toEqual({ name: "Item 1" });
    });
  });
});
