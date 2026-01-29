import { beforeEach, describe, expect, it } from "vitest";
import { fastJsonStringifyMap } from "../../src/ajv/fast_json_stringify_cache.js";
import { openapiSchemaMap } from "../../src/ajv/openapi_schema_map.js";
import { getSchemaRefKey } from "../../src/ajv/schema_ref_cache.js";
import type { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { Router } from "../../src/server/router/router.js";

describe("Router - Inline Route Schema Caching", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    // Clear caches before each test
    openapiSchemaMap.clear();
    fastJsonStringifyMap.clear();
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

    router.get("/test", handler, {
      responses: {
        200: responseSchema,
      },
    });

    // Verify schema is cached in openapiSchemaMap (for validation)
    const validatorRefKey = getSchemaRefKey(responseSchema, "serialize_json");
    expect(openapiSchemaMap.has(validatorRefKey)).toBe(true);

    // Verify schema is cached in fastJsonStringifyMap (for serialization)
    // Different prefix is used for serialization cache
    const serializerRefKey = getSchemaRefKey(
      responseSchema,
      "fast_stringify_json",
    );
    expect(fastJsonStringifyMap.has(serializerRefKey)).toBe(true);
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

    router.get("/multi", handler, {
      responses: {
        200: schema200,
        404: schema404,
      },
    });

    // Verify both schemas are cached
    const refKey200 = getSchemaRefKey(schema200, "serialize_json");
    const refKey404 = getSchemaRefKey(schema404, "serialize_json");

    expect(openapiSchemaMap.has(refKey200)).toBe(true);
    expect(openapiSchemaMap.has(refKey404)).toBe(true);
  });

  it("should include response schemas in route metadata", () => {
    const responseSchema = {
      type: "object",
      properties: { result: { type: "boolean" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.post("/action", handler, {
      responses: {
        201: responseSchema,
      },
    });

    const routes = router.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].responseSchemas).toBeDefined();
    expect(routes[0].responseSchemas![201]).toBe(responseSchema);
  });

  it("should pass response schemas through router.find() for static routes", () => {
    const responseSchema = {
      type: "object",
      properties: { id: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get("/users", handler, {
      responses: {
        200: responseSchema,
      },
    });

    const match = router.find("GET", "/users");
    expect(match).not.toBeNull();
    expect(match!.responseSchemas).toBeDefined();
    expect(match!.responseSchemas![200]).toBe(responseSchema);
  });

  it("should pass response schemas through router.find() for dynamic routes", () => {
    const responseSchema = {
      type: "object",
      properties: { userId: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get("/users/:id", handler, {
      responses: {
        200: responseSchema,
      },
    });

    const match = router.find("GET", "/users/123");
    expect(match).not.toBeNull();
    expect(match!.params).toEqual({ id: "123" });
    expect(match!.responseSchemas).toBeDefined();
    expect(match!.responseSchemas![200]).toBe(responseSchema);
  });

  it("should handle routes without response schemas", () => {
    const handler = (req: Request, res: Response) => {};

    router.get("/no-schema", handler);

    const match = router.find("GET", "/no-schema");
    expect(match).not.toBeNull();
    expect(match!.responseSchemas).toBeUndefined();
  });

  it("should cache schemas only once for the same schema object", () => {
    const sharedSchema = {
      type: "object",
      properties: { shared: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get("/route1", handler, {
      responses: { 200: sharedSchema },
    });

    const initialCacheSize = openapiSchemaMap.size;

    router.get("/route2", handler, {
      responses: { 200: sharedSchema },
    });

    // Cache size should not increase since it's the same schema object
    expect(openapiSchemaMap.size).toBe(initialCacheSize);
  });

  it("should update response schemas when route is updated", () => {
    const schema1 = {
      type: "object",
      properties: { version: { type: "number" } },
    } as const;

    const schema2 = {
      type: "object",
      properties: { version: { type: "string" } },
    } as const;

    const handler = (req: Request, res: Response) => {};

    router.get("/versioned", handler, {
      responses: { 200: schema1 },
    });

    let routes = router.getRoutes();
    expect(routes[0].responseSchemas![200]).toBe(schema1);

    // Update the route with new schema
    router.get("/versioned", handler, {
      responses: { 200: schema2 },
    });

    routes = router.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].responseSchemas![200]).toBe(schema2);
  });
});

describe("Response - Automatic Schema Application", () => {
  it("should use route response schema automatically in Response.json()", () => {
    const responseSchema = {
      type: "object",
      properties: {
        message: { type: "string" },
        timestamp: { type: "number" },
      },
      required: ["message"],
    } as const;

    const response = new Response(200);
    response.setRouteResponseSchemas({ 200: responseSchema });

    // Call json without explicit schema
    response.json({ message: "test", timestamp: Date.now() });

    // Verify the schema was applied (serializer should be set)
    const body = response.getBody();
    expect(typeof body).toBe("string"); // Should be serialized by fast-json-stringify
  });

  it("should prioritize explicit schema over route schema", () => {
    const routeSchema = {
      type: "object",
      properties: { route: { type: "string" } },
    } as const;

    const explicitSchema = {
      type: "object",
      properties: { explicit: { type: "string" } },
    } as const;

    const response = new Response(200);
    response.setRouteResponseSchemas({ 200: routeSchema });

    // Call json with explicit schema
    response.json({ explicit: "value" }, explicitSchema);

    // The explicit schema should be used (not the route schema)
    const body = response.getBody();
    expect(typeof body).toBe("string"); // Serialized
  });

  it("should handle different status codes with different schemas", () => {
    const schema200 = {
      type: "object",
      properties: { success: { type: "boolean" } },
    } as const;

    const schema404 = {
      type: "object",
      properties: { error: { type: "string" } },
    } as const;

    const response = new Response(200);
    response.setRouteResponseSchemas({
      200: schema200,
      404: schema404,
    });

    // Status 200 should use schema200
    response.json({ success: true });
    let body = response.getBody();
    expect(typeof body).toBe("string");

    // Change status to 404
    const response404 = new Response(404);
    response404.setRouteResponseSchemas({
      200: schema200,
      404: schema404,
    });

    response404.json({ error: "Not found" });
    body = response404.getBody();
    expect(typeof body).toBe("string");
  });

  it("should work without route schemas (backward compatibility)", () => {
    const response = new Response(200);

    // No route schemas set
    response.json({ message: "test" });

    const body = response.getBody();
    // Should return object directly (not serialized since no schema)
    expect(typeof body).toBe("object");
    expect(body).toEqual({ message: "test" });
  });

  it("should handle missing schema for current status code", () => {
    const response = new Response(200);
    response.setRouteResponseSchemas({
      404: { type: "object", properties: { error: { type: "string" } } },
    });

    // Status 200 has no schema defined
    response.json({ message: "test" });

    const body = response.getBody();
    // Should return object directly since no schema for 200
    expect(typeof body).toBe("object");
    expect(body).toEqual({ message: "test" });
  });
});
