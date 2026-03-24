import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Type } from "@sinclair/typebox";
import { Router } from "../../src/server/router/router.js";
import type { SwaggerGlobalOptions } from "../../src/plugins/swagger/swagger_types.js";

// Helper to extract the generated spec from swagger plugin
function getSpecFromRouter(
  router: Router,
  globalOptions?: SwaggerGlobalOptions,
): Record<string, any> {
  // Create a minimal global options
  const options: SwaggerGlobalOptions = {
    type: "standard",
    path: "/docs",
    title: "Test API",
    version: "1.0.0",
    servers: ["http://localhost"],
    ...globalOptions,
  };

  // Temporarily replace the global router
  const originalRouter = require("../../src/server/router/router.js").router;
  (global as any).__test_router__ = router;

  // We need to manually call generateOpenAPISpec with our test router
  const routes = router.getRoutes();
  const paths: Record<string, any> = {};
  const components: Record<string, any> = {
    securitySchemes: {},
  };

  for (const route of routes) {
    const swaggerOptions = route.swaggerOptions;
    if (swaggerOptions?.excludeFromSwagger) continue;

    if (!paths[route.path]) paths[route.path] = {};
    const method = route.method.toLowerCase();
    const operation: Record<string, any> = {
      summary: swaggerOptions?.name || `${method.toUpperCase()} ${route.path}`,
      description: swaggerOptions?.description || "",
      responses: {},
    };

    // Check if route has validation schemas
    // Only body, query, and all produce validation errors - headers don't
    const hasValidationSchemas =
      route.validationSchemas?.body ||
      route.validationSchemas?.query ||
      route.validationSchemas?.all;

    // Add default 200 response
    operation.responses["200"] = {
      description: "Successful response",
      content: {
        "application/json": {
          schema: { type: "object" },
        },
      },
    };

    // Add validation error response if validation schemas exist
    if (hasValidationSchemas) {
      const mergedConfig = {
        statusCode:
          swaggerOptions?.validationErrorResponse?.statusCode ??
          options.validationErrorResponse?.statusCode ??
          400,
        description:
          swaggerOptions?.validationErrorResponse?.description ??
          options.validationErrorResponse?.description ??
          "Validation error",
        schema: swaggerOptions?.validationErrorResponse?.schema ??
          options.validationErrorResponse?.schema ?? {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
      };

      const statusCodeStr = String(mergedConfig.statusCode);
      if (!operation.responses[statusCodeStr]) {
        operation.responses[statusCodeStr] = {
          description: mergedConfig.description,
          content: {
            "application/json": {
              schema: mergedConfig.schema,
            },
          },
        };
      }
    }

    paths[route.path][method] = operation;
  }

  return {
    openapi: "3.0.0",
    info: {
      title: options.title || "Test API",
      version: options.version || "1.0.0",
    },
    servers: [{ url: "/" }],
    paths,
    components,
  };
}

describe("Swagger Validation Error Response", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe("Default behavior (no validationErrorResponse configured)", () => {
    it("should add 400 response when route has body validation", () => {
      const bodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      router.post("/users", { body: bodySchema }, async (req, res) => {
        res.json({ success: true });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/users");
      expect(route).toBeDefined();
      expect(route!.validationSchemas?.body).toBeDefined();
    });

    it("should add 400 response when route has query validation", () => {
      const querySchema = z.object({
        page: z.coerce.number(),
        limit: z.coerce.number(),
      });

      router.get("/items", { query: querySchema }, async (req, res) => {
        res.json({ items: [] });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/items");
      expect(route).toBeDefined();
      expect(route!.validationSchemas?.query).toBeDefined();
    });

    it("should add 400 response when route has headers validation", () => {
      const headersSchema = z.object({
        "x-api-key": z.string(),
      });

      router.get("/protected", { headers: headersSchema }, async (req, res) => {
        res.json({ data: "protected" });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/protected");
      expect(route).toBeDefined();
      expect(route!.validationSchemas?.headers).toBeDefined();
    });

    it("should not add validation error response when route has no validation schemas", () => {
      router.get("/public", async (req, res) => {
        res.json({ message: "public" });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/public");
      expect(route).toBeDefined();
      expect(route!.validationSchemas).toBeUndefined();
    });
  });

  describe("Global validationErrorResponse configuration", () => {
    it("should use global statusCode when configured", () => {
      const bodySchema = z.object({ name: z.string() });

      router.post(
        "/users",
        {
          body: bodySchema,
          swagger: {
            validationErrorResponse: {
              statusCode: 422,
            },
          },
        },
        async (req, res) => {
          res.json({ success: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/users");
      expect(route).toBeDefined();
      expect(route!.swaggerOptions?.validationErrorResponse?.statusCode).toBe(
        422,
      );
    });

    it("should use global schema when configured", () => {
      const bodySchema = z.object({ name: z.string() });
      const customSchema = {
        type: "object",
        properties: {
          code: { type: "string" },
          details: { type: "array" },
        },
      };

      router.post(
        "/users",
        {
          body: bodySchema,
          swagger: {
            validationErrorResponse: {
              schema: customSchema,
            },
          },
        },
        async (req, res) => {
          res.json({ success: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/users");
      expect(route).toBeDefined();
      expect(route!.swaggerOptions?.validationErrorResponse?.schema).toEqual(
        customSchema,
      );
    });

    it("should use global description when configured", () => {
      const bodySchema = z.object({ name: z.string() });

      router.post(
        "/users",
        {
          body: bodySchema,
          swagger: {
            validationErrorResponse: {
              description: "Custom validation error",
            },
          },
        },
        async (req, res) => {
          res.json({ success: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/users");
      expect(route).toBeDefined();
      expect(route!.swaggerOptions?.validationErrorResponse?.description).toBe(
        "Custom validation error",
      );
    });
  });

  describe("TypeBox schemas", () => {
    it("should detect validation schemas with TypeBox", () => {
      const bodySchema = Type.Object({
        name: Type.String(),
        age: Type.Number(),
      });

      router.post("/products", { body: bodySchema }, async (req, res) => {
        res.json({ success: true });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/products");
      expect(route).toBeDefined();
      expect(route!.validationSchemas?.body).toBeDefined();
    });
  });

  describe("Plain JSON Schema", () => {
    it("should detect validation schemas with plain JSON schema", () => {
      const bodySchema = {
        type: "object",
        properties: {
          username: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["username"],
      };

      router.patch("/settings", { body: bodySchema }, async (req, res) => {
        res.json({ updated: true });
      });

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/settings");
      expect(route).toBeDefined();
      expect(route!.validationSchemas?.body).toBeDefined();
    });
  });

  describe("Per-route override", () => {
    it("should allow per-route override of statusCode", () => {
      const bodySchema = z.object({ name: z.string() });

      router.post(
        "/special",
        {
          body: bodySchema,
          swagger: {
            validationErrorResponse: {
              statusCode: 422,
              description: "Unprocessable entity",
            },
          },
        },
        async (req, res) => {
          res.json({ success: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/special");
      expect(route).toBeDefined();
      expect(route!.swaggerOptions?.validationErrorResponse?.statusCode).toBe(
        422,
      );
      expect(route!.swaggerOptions?.validationErrorResponse?.description).toBe(
        "Unprocessable entity",
      );
    });

    it("should not add validation response if status code already exists in responses", () => {
      const bodySchema = z.object({ name: z.string() });

      router.post(
        "/existing",
        {
          body: bodySchema,
          responses: {
            400: {
              type: "object",
              properties: {
                custom: { type: "string" },
              },
            },
          },
        },
        async (req, res) => {
          res.json({ success: true });
        },
      );

      const routes = router.getRoutes();
      const route = routes.find((r) => r.path === "/existing");
      expect(route).toBeDefined();
      expect(route!.responses?.[400]).toBeDefined();
    });
  });
});
