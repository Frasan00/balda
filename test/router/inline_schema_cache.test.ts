import { beforeEach, describe, expect, it } from "vitest";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import type { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { Router } from "../../src/server/router/router.js";

describe("Router - Inline Route Schema Caching", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    // Clear Ajv caches before each test
    AjvStateManager.clearAllCaches();
  });

  it("should compile and cache response schemas during route registration", () => {
    const responseSchema = {
      type: "object",
      properties: {
        message: { type: "string" },
        count: { type: "number" },
      },
      required: ["message"],
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get(
      "/test",
      {
        swagger: {
          responses: {
            200: responseSchema,
          },
        },
      },
      handler,
    );

    // Verify schema is stored in Ajv
    const cachedSchema = AjvStateManager.getJsonSchema(
      responseSchema,
      "serialize_json",
    );
    expect(cachedSchema).toBeDefined();
  });

  it("should cache multiple response schemas for different status codes", () => {
    const schema200 = {
      type: "object",
      properties: { data: { type: "string" } },
    } as const;

    const schema404 = {
      type: "object",
      properties: { error: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get(
      "/multi",
      {
        swagger: {
          responses: {
            200: schema200,
            404: schema404,
          },
        },
      },
      handler,
    );

    // Verify both schemas are cached in Ajv
    const cached200 = AjvStateManager.getJsonSchema(
      schema200,
      "serialize_json",
    );
    const cached404 = AjvStateManager.getJsonSchema(
      schema404,
      "serialize_json",
    );

    expect(cached200).toBeDefined();
    expect(cached404).toBeDefined();
  });

  it("should include response schemas in route metadata", () => {
    const responseSchema = {
      type: "object",
      properties: { result: { type: "boolean" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.post(
      "/action",
      {
        swagger: {
          responses: {
            201: responseSchema,
          },
        },
      },
      handler,
    );

    const routes = router.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].responseSchemas).toBeDefined();
    expect(routes[0].responseSchemas![201]).toBe(responseSchema);
  });

  it("should pass response schemas through router.find() for static routes", () => {
    const responseSchema = {
      type: "object",
      properties: { success: { type: "boolean" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.put(
      "/update",
      {
        swagger: {
          responses: {
            200: responseSchema,
          },
        },
      },
      handler,
    );

    const found = router.find("PUT", "/update");
    expect(found).toBeDefined();
    expect(found?.responseSchemas).toBeDefined();
    expect(found?.responseSchemas![200]).toBe(responseSchema);
  });

  it("should pass response schemas through router.find() for dynamic routes", () => {
    const responseSchema = {
      type: "object",
      properties: { id: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get(
      "/users/:id",
      {
        swagger: {
          responses: {
            200: responseSchema,
          },
        },
      },
      handler,
    );

    const found = router.find("GET", "/users/123");
    expect(found).toBeDefined();
    expect(found?.responseSchemas).toBeDefined();
    expect(found?.responseSchemas![200]).toBe(responseSchema);
  });

  it("should handle routes without response schemas", () => {
    const handler = (req: Request, res: Response) => {};

    router.delete("/remove", handler);

    const routes = router.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].responseSchemas).toBeUndefined();
  });

  it("should compile request schemas during route registration", () => {
    const bodySchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
      },
      required: ["name", "email"],
    } as const;

    const querySchema = {
      type: "object",
      properties: {
        page: { type: "number" },
      },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.post(
      "/create",
      {
        body: bodySchema,
        query: querySchema,
      },
      handler,
    );

    // Verify both request schemas are stored in Ajv
    const cachedBody = AjvStateManager.getJsonSchema(bodySchema, "json_schema");
    const cachedQuery = AjvStateManager.getJsonSchema(
      querySchema,
      "json_schema",
    );

    expect(cachedBody).toBeDefined();
    expect(cachedQuery).toBeDefined();
  });

  it("should handle mixed request and response schemas", () => {
    const requestSchema = {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    } as const;

    const responseSchema = {
      type: "object",
      properties: {
        output: { type: "string" },
      },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.post(
      "/transform",
      {
        body: requestSchema,
        swagger: {
          responses: {
            200: responseSchema,
          },
        },
      },
      handler,
    );

    // Verify both schemas are cached
    const cachedRequest = AjvStateManager.getJsonSchema(
      requestSchema,
      "json_schema",
    );
    const cachedResponse = AjvStateManager.getJsonSchema(
      responseSchema,
      "serialize_json",
    );

    expect(cachedRequest).toBeDefined();
    expect(cachedResponse).toBeDefined();
  });
});
