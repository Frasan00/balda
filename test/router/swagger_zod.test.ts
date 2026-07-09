import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Type } from "@sinclair/typebox";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { Router } from "../../src/server/router/router.js";
import { ZodLoader } from "../../src/validator/zod_loader.js";
import { TypeBoxLoader } from "../../src/validator/typebox_loader.js";
import type { ZodType } from "zod";
import type { ZodObject } from "zod";

/**
 * Builds an OpenAPI spec from a Router's registered routes, replicating
 * the internal logic of swagger.ts's generateOpenAPISpec so we can test
 * the full Swagger pipeline (Zod → toJSONSchema → OpenAPI paths).
 */
function buildSpec(router: Router): Record<string, any> {
  const routes = router.getRoutes();
  const paths: Record<string, any> = {};

  function getOrConvert(schema: any, opts?: { io: "input" | "output" }): any {
    if (!schema || typeof schema !== "object") return { type: "string" };
    if (ZodLoader.isZodSchema(schema)) {
      return ZodLoader.toJSONSchema(schema, opts);
    }
    if (TypeBoxLoader.isTypeBoxSchema(schema)) return schema;
    return schema;
  }

  for (const route of routes) {
    const swaggerOpts = route.swaggerOptions;
    if (swaggerOpts?.excludeFromSwagger) continue;
    if (!paths[route.path]) paths[route.path] = {};
    const method = route.method.toLowerCase();
    const operation: any = {
      summary: swaggerOpts?.name || `${method.toUpperCase()} ${route.path}`,
      description: swaggerOpts?.description || "",
      tags: swaggerOpts?.service ? [swaggerOpts.service] : [],
    };

    let parameters: any[] = [];

    // Query params
    const querySchema = route.validationSchemas?.query as any;
    if (querySchema && querySchema.shape) {
      for (const [name, schema] of Object.entries(querySchema.shape)) {
        if (!schema || typeof schema !== "object") continue;
        parameters.push({
          name,
          in: "query",
          required: false,
          schema: getOrConvert(schema, { io: "input" }),
        });
      }
    }

    // Headers
    const headerSchema = route.validationSchemas?.headers as any;
    if (headerSchema && headerSchema.shape) {
      for (const [name, schema] of Object.entries(headerSchema.shape)) {
        if (!schema || typeof schema !== "object") continue;
        parameters.push({
          name,
          in: "header",
          required: false,
          schema: getOrConvert(schema, { io: "input" }),
        });
      }
    }

    // Path params
    const regex = /:([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = regex.exec(route.path)) !== null) {
      parameters.push({
        name: match[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }
    // Normalize path :param → {param} for OpenAPI
    const openApiPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");

    if (parameters.length > 0) operation.parameters = parameters;

    // Body
    const bodySchema =
      route.validationSchemas?.body || route.validationSchemas?.all;
    if (bodySchema) {
      operation.requestBody = {
        content: {
          "application/json": {
            schema: getOrConvert(bodySchema, { io: "input" }),
          },
        },
        required: true,
      };
    }

    // Responses
    operation.responses = {};
    if (route.responses) {
      for (const [statusCode, schema] of Object.entries(route.responses)) {
        operation.responses[statusCode] = {
          description: `Response for ${statusCode}`,
          content: {
            "application/json": {
              schema: getOrConvert(schema, { io: "output" }),
            },
          },
        };
      }
    }
    if (Object.keys(operation.responses).length === 0) {
      operation.responses["200"] = {
        description: "Successful response",
        content: { "application/json": { schema: { type: "object" } } },
      };
    }

    if (!paths[openApiPath]) paths[openApiPath] = {};
    paths[openApiPath][method] = operation;
  }

  return {
    openapi: "3.0.0",
    info: { title: "Test API", version: "1.0.0" },
    servers: [{ url: "/" }],
    paths,
    components: { securitySchemes: {} },
  };
}

describe("Swagger — Zod schema integration", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    AjvStateManager.clearAllCaches();
  });

  it("response with z.coerce.date() → { type: string, format: date-time }", () => {
    const schema = z.object({
      id: z.string(),
      code: z.string(),
      qrPayload: z.string(),
      expiresAt: z.coerce.date(),
    });

    router.post(
      "/api/pairing",
      {
        responses: { 200: schema },
        swagger: { service: "Pairing" },
      },
      async (_req, res) => {
        res.created({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/api/pairing"].post.responses["200"].content[
        "application/json"
      ].schema;
    expect(resp.properties.id.type).toBe("string");
    expect(resp.properties.expiresAt.type).toBe("string");
    expect(resp.properties.expiresAt.format).toBe("date-time");
  });

  it("request body with .transform(Number) → io:input shows string type", () => {
    const schema = z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      name: z.string(),
    });

    router.post("/search", { body: schema }, async (req, res) => {
      res.json({ page: req.body.page });
    });

    const spec = buildSpec(router);
    const body =
      spec.paths["/search"].post.requestBody.content["application/json"].schema;
    expect(body.properties.page.type).toBe("string");
    expect(body.properties.page.pattern).toBe("^\\d+$");
    expect(body.properties.name.type).toBe("string");
  });

  it("query params with z.coerce.number() → { type: number }", () => {
    const schema = z.object({
      page: z.coerce.number(),
      limit: z.coerce.number(),
    });

    router.get("/list", { query: schema }, async (req, res) => {
      res.json({ page: req.query.page });
    });

    const spec = buildSpec(router);
    const params = spec.paths["/list"].get.parameters;
    const pageParam = params.find((p: any) => p.name === "page");
    expect(pageParam.schema.type).toBe("number");
  });

  it("headers with Zod schema → header params", () => {
    const schema = z.object({
      "x-api-key": z.string(),
      "x-request-id": z.string().uuid(),
    });

    router.get("/secure", { headers: schema }, async (req, res) => {
      res.json({ ok: true });
    });

    const spec = buildSpec(router);
    const params = spec.paths["/secure"].get.parameters;
    const apiKeyParam = params.find((p: any) => p.name === "x-api-key");
    expect(apiKeyParam.in).toBe("header");
    expect(apiKeyParam.schema.type).toBe("string");
  });

  it("response with z.date().nullable() → nullable + date-time", () => {
    const schema = z.object({ createdAt: z.date().nullable() });

    router.get("/item", { responses: { 200: schema } }, async (req, res) => {
      res.json({});
    });

    const spec = buildSpec(router);
    const resp =
      spec.paths["/item"].get.responses["200"].content["application/json"]
        .schema;
    expect(resp.properties.createdAt.type).toBe("string");
    expect(resp.properties.createdAt.format).toBe("date-time");
    expect(resp.properties.createdAt.nullable).toBe(true);
  });

  it("response with array of dates → items have date-time", () => {
    const schema = z.object({ dates: z.array(z.coerce.date()) });

    router.get("/events", { responses: { 200: schema } }, async (req, res) => {
      res.json({});
    });

    const spec = buildSpec(router);
    const resp =
      spec.paths["/events"].get.responses["200"].content["application/json"]
        .schema;
    expect(resp.properties.dates.type).toBe("array");
    expect(resp.properties.dates.items.type).toBe("string");
    expect(resp.properties.dates.items.format).toBe("date-time");
  });

  it("mixed request + response: io:input for body, io:output for response", () => {
    const reqSchema = z.object({
      dateStr: z.string().transform((s) => new Date(s)),
    });
    const respSchema = z.object({
      createdAt: z.coerce.date(),
      processedAt: z.date(),
    });

    router.post(
      "/process",
      {
        body: reqSchema,
        responses: { 200: respSchema },
      },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    // Body: io:input → dateStr is string (pre-transform)
    const body =
      spec.paths["/process"].post.requestBody.content["application/json"]
        .schema;
    expect(body.properties.dateStr.type).toBe("string");
    // Response: io:output → dates are string with date-time
    const resp =
      spec.paths["/process"].post.responses["200"].content["application/json"]
        .schema;
    expect(resp.properties.createdAt.type).toBe("string");
    expect(resp.properties.createdAt.format).toBe("date-time");
    expect(resp.properties.processedAt.type).toBe("string");
    expect(resp.properties.processedAt.format).toBe("date-time");
  });

  it("path params with Zod schema → {param} in OpenAPI path", () => {
    const schema = z.object({ id: z.string() });

    router.get(
      "/users/:id",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    expect(spec.paths["/users/{id}"]).toBeDefined();
    const params = spec.paths["/users/{id}"].get.parameters;
    const idParam = params.find((p: any) => p.name === "id");
    expect(idParam.in).toBe("path");
    expect(idParam.required).toBe(true);
  });

  it("response with nested date + union", () => {
    const schema = z.object({
      data: z.object({
        value: z.union([z.string(), z.coerce.date()]),
        timestamp: z.coerce.date(),
      }),
    });

    router.get("/complex", { responses: { 200: schema } }, async (req, res) => {
      res.json({});
    });

    const spec = buildSpec(router);
    const resp =
      spec.paths["/complex"].get.responses["200"].content["application/json"]
        .schema;
    expect(resp.properties.data.properties.timestamp.type).toBe("string");
    expect(resp.properties.data.properties.timestamp.format).toBe("date-time");
    // Union should have anyOf with string and date-time
    const unionSchema = resp.properties.data.properties.value;
    expect(unionSchema.anyOf).toBeDefined();
  });

  it("TypeBox body schema still works", () => {
    const bodySchema = Type.Object({ name: Type.String(), age: Type.Number() });

    router.post("/products", { body: bodySchema }, async (req, res) => {
      res.json({ ok: true });
    });

    const spec = buildSpec(router);
    const body =
      spec.paths["/products"].post.requestBody.content["application/json"]
        .schema;
    expect(body.type).toBe("object");
    expect(body.properties.name.type).toBe("string");
    expect(body.properties.age.type).toBe("number");
  });

  it("plain JSON schema body still works", () => {
    const bodySchema = {
      type: "object",
      properties: { username: { type: "string" } },
      required: ["username"],
    } as const;

    router.post("/settings", { body: bodySchema }, async (req, res) => {
      res.json({ ok: true });
    });

    const spec = buildSpec(router);
    const body =
      spec.paths["/settings"].post.requestBody.content["application/json"]
        .schema;
    expect(body.type).toBe("object");
    expect(body.properties.username.type).toBe("string");
  });

  it("swagger service tags", () => {
    router.get(
      "/api/pairing",
      {
        swagger: { service: "Pairing" },
      },
      async (req, res) => {
        res.json({});
      },
    );
    router.post(
      "/api/users",
      {
        swagger: { service: "Users" },
      },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    expect(spec.paths["/api/pairing"].get.tags).toEqual(["Pairing"]);
    expect(spec.paths["/api/users"].post.tags).toEqual(["Users"]);
  });

  it("route with no schemas → default 200 response", () => {
    router.get("/health", async (req, res) => {
      res.json({ ok: true });
    });

    const spec = buildSpec(router);
    expect(spec.paths["/health"].get.responses["200"]).toBeDefined();
    expect(spec.paths["/health"].get.responses["200"].description).toBe(
      "Successful response",
    );
  });

  it("response with z.coerce.date().optional() → not in required array", () => {
    const schema = z.object({
      id: z.string(),
      expiresAt: z.coerce.date().optional(),
    });

    router.get(
      "/optional-date",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/optional-date"].get.responses["200"].content[
        "application/json"
      ].schema;
    expect(resp.properties.expiresAt.type).toBe("string");
    expect(resp.properties.expiresAt.format).toBe("date-time");
    // id is required, expiresAt is not
    expect(resp.required).toContain("id");
    expect(resp.required).not.toContain("expiresAt");
  });

  it("response with z.coerce.date().default() → has default + date-time", () => {
    const schema = z.object({
      d: z.coerce.date().default(new Date("2020-01-01T00:00:00.000Z")),
    });

    router.get(
      "/default-date",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/default-date"].get.responses["200"].content[
        "application/json"
      ].schema;
    expect(resp.properties.d.type).toBe("string");
    expect(resp.properties.d.format).toBe("date-time");
    expect(resp.properties.d.default).toBe("2020-01-01T00:00:00.000Z");
  });

  it("query with z.coerce.date() → param has empty schema (io:input, date not fixed for input)", () => {
    const schema = z.object({
      from: z.coerce.date(),
    });

    router.get("/range", { query: schema }, async (req, res) => {
      res.json({});
    });

    const spec = buildSpec(router);
    const params = spec.paths["/range"].get.parameters;
    const fromParam = params.find((p: any) => p.name === "from");
    // io: "input" — date override only fires for output mode
    // Fastify also leaves it as {} for input
    expect(fromParam.schema).toEqual({});
  });

  it("response with .refine() → schema still shows properties", () => {
    const schema = z.object({
      age: z.number().refine((v) => v >= 0, "must be positive"),
      name: z.string(),
    });

    router.get(
      "/validated",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/validated"].get.responses["200"].content["application/json"]
        .schema;
    expect(resp.properties.age.type).toBe("number");
    expect(resp.properties.name.type).toBe("string");
  });

  it("response with .superRefine() → schema still shows properties", () => {
    const schema = z.object({
      pass: z.string().superRefine((val, ctx) => {
        if (val.length < 8)
          ctx.addIssue({ code: "custom", message: "too short" });
      }),
    });

    router.get(
      "/password-check",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/password-check"].get.responses["200"].content[
        "application/json"
      ].schema;
    expect(resp.properties.pass.type).toBe("string");
  });

  it("response with discriminated union", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), value: z.string() }),
      z.object({ type: z.literal("b"), value: z.number() }),
    ]);

    router.get(
      "/union-response",
      { responses: { 200: schema } },
      async (req, res) => {
        res.json({});
      },
    );

    const spec = buildSpec(router);
    const resp =
      spec.paths["/union-response"].get.responses["200"].content[
        "application/json"
      ].schema;
    expect(resp.oneOf).toBeDefined();
    expect(resp.oneOf).toHaveLength(2);
  });
});
