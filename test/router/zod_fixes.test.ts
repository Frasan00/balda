import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AjvStateManager } from "../../src/ajv/ajv.js";
import { Router } from "../../src/server/router/router.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { ZodLoader } from "../../src/validator/zod_loader.js";

// ── The exact schema from the user's original report ──────────────────────
const CreatePairingResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  qrPayload: z.string(),
  expiresAt: z.coerce.date(),
});

describe("Zod validation fixes", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    AjvStateManager.clearAllCaches();
  });

  // ── Original issue: POST /api/pairing Swagger docs showed {} ──────────────
  describe("Swagger docs — z.coerce.date() in response schema", () => {
    it("should produce { type: string, format: date-time } for z.coerce.date()", () => {
      const json = ZodLoader.toJSONSchema(CreatePairingResponseSchema);
      const props = (json as any).properties;

      expect(props.id.type).toBe("string");
      expect(props.code.type).toBe("string");
      expect(props.qrPayload.type).toBe("string");
      // This was {} before the fix:
      expect(props.expiresAt.type).toBe("string");
      expect(props.expiresAt.format).toBe("date-time");
    });

    it("should not throw during route registration", () => {
      expect(() => {
        router.post(
          "/api/pairing",
          {
            responses: { 200: CreatePairingResponseSchema },
            swagger: { service: "Pairing" },
          },
          async (_req, res) => {
            res.created(
              await Promise.resolve({
                id: "1",
                code: "ABC",
                qrPayload: "payload",
                expiresAt: new Date(),
              }),
            );
          },
        );
      }).not.toThrow();
    });
  });

  // ── Audit issue: transforms break request validation ─────────────────────
  describe("Request validation — transforms", () => {
    it("should validate .transform(Number) without throwing", () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
      });
      const req = new Request();
      req.body = { page: "42" };

      const result = req.validate(schema, true);
      expect(result.page).toBe(42);
      expect(typeof result.page).toBe("number");
    });

    it("should not throw during route registration with transform schema", () => {
      expect(() => {
        router.get(
          "/api/admin/tmdb/discover",
          {
            query: z.object({
              kind: z.string(),
              page: z.string().regex(/^\d+$/).transform(Number).optional(),
              sortBy: z.string().optional(),
            }),
          },
          async (req, res) => {
            res.json({ page: req.query.page });
          },
        );
      }).not.toThrow();
    });
  });

  // ── Audit issue: z.coerce.number() broken for real HTTP query strings ─────
  describe("Request validation — z.coerce.number() from string", () => {
    it("should coerce string '1' to number 1 (real HTTP query param)", async () => {
      const schema = z.object({
        page: z.coerce.number().positive(),
        limit: z.coerce.number().max(100),
      });

      router.get("/list", { query: schema }, async (req, res) => {
        res.json({ page: req.query.page, limit: req.query.limit });
      });

      const found = router.find("GET", "/list");
      const req = new Request();
      // Real HTTP: query params are always strings
      req.setQueryString("page=1&limit=10");
      const res = new Response();
      await found!.handler(req, res);

      expect(res.responseStatus).toBe(200);
      const body = res.getBody();
      expect(body.page).toBe(1);
      expect(typeof body.page).toBe("number");
      expect(body.limit).toBe(10);
    });
  });

  // ── Audit issue: {} body swallows the real error ─────────────────────────
  describe("Validation error body — should be structured, not {}", () => {
    it("should return { message, errors } not a raw Error (which JSON.stringifies to {})", async () => {
      const schema = z.object({
        count: z.number().positive(),
      });

      router.post("/test", { body: schema }, async (req, res) => {
        res.json({ count: (req.body as any).count });
      });

      const found = router.find("POST", "/test");
      const req = new Request();
      req.body = { count: -5 };
      const res = new Response();
      await found!.handler(req, res);

      expect(res.responseStatus).toBe(422);
      const body = res.getBody();
      // Before fix: body was a raw Error → JSON.stringify(Error) = "{}"
      // After fix: body is a structured object
      expect(body).toBeDefined();
      expect(typeof body).toBe("object");
      expect("message" in body).toBe(true);
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.message).not.toBe("");
    });

    it("should return structured Zod validation errors with field paths", async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      router.post("/register", { body: schema }, async (req, res) => {
        res.json({ ok: true });
      });

      const found = router.find("POST", "/register");
      const req = new Request();
      req.body = { email: "not-an-email", age: 10 };
      const res = new Response();
      await found!.handler(req, res);

      expect(res.responseStatus).toBe(422);
      const body = res.getBody();
      expect(body.errors.length).toBeGreaterThan(0);
      // Zod issues should have the field path
      const hasEmailError = body.errors.some((e: any) =>
        e.instancePath?.includes("email"),
      );
      const hasAgeError = body.errors.some((e: any) =>
        e.instancePath?.includes("age"),
      );
      expect(hasEmailError || hasAgeError).toBe(true);
    });
  });

  // ── Date types in various Zod constructs ─────────────────────────────────
  describe("ZodLoader.toJSONSchema — unrepresentable types", () => {
    it("should convert z.date() to string with date-time format", () => {
      const schema = z.object({ createdAt: z.date() });
      const json = ZodLoader.toJSONSchema(schema);
      expect((json as any).properties.createdAt.type).toBe("string");
      expect((json as any).properties.createdAt.format).toBe("date-time");
    });

    it("should produce {} for z.coerce.bigint() (matching Fastify)", () => {
      const schema = z.object({ big: z.coerce.bigint() });
      const json = ZodLoader.toJSONSchema(schema);
      expect((json as any).properties.big).toEqual({});
    });

    it("should handle nested date types in objects and arrays", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          createdAt: z.coerce.date(),
        }),
        items: z.array(z.coerce.date()),
      });
      const json = ZodLoader.toJSONSchema(schema);
      const props = (json as any).properties;
      expect(props.user.properties.createdAt.type).toBe("string");
      expect(props.user.properties.createdAt.format).toBe("date-time");
      expect(props.items.items.type).toBe("string");
      expect(props.items.items.format).toBe("date-time");
    });

    it("should handle optional/nullable date types", () => {
      const schema = z.object({
        maybeDate: z.coerce.date().optional(),
        nullableDate: z.date().nullable(),
      });
      const json = ZodLoader.toJSONSchema(schema);
      const props = (json as any).properties;
      expect(props.maybeDate.type).toBe("string");
      expect(props.maybeDate.format).toBe("date-time");
      // OpenAPI 3.0 target uses nullable: true instead of anyOf
      expect(props.nullableDate.type).toBe("string");
      expect(props.nullableDate.format).toBe("date-time");
      expect(props.nullableDate.nullable).toBe(true);
    });

    it("should handle transforms with io: input (pre-transform type, matching Fastify)", () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
      });
      // io: "output" (default) produces {} for transform output type
      // io: "input" shows the pre-transform input type (what the client sends)
      const json = ZodLoader.toJSONSchema(schema, { io: "input" });
      expect((json as any).properties.page.type).toBe("string");
      expect((json as any).properties.page.pattern).toBe("^\\d+$");
    });

    it("should produce {} for transform output type (matching Fastify)", () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
      });
      // Default io is "output" — transform output can't be represented,
      // so it produces {} (same as Fastify)
      const json = ZodLoader.toJSONSchema(schema);
      expect((json as any).properties.page).toEqual({});
    });

    it("should still convert simple schemas normally", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });
      const json = ZodLoader.toJSONSchema(schema);
      const props = (json as any).properties;
      expect(props.name.type).toBe("string");
      expect(props.age.type).toBe("number");
      expect(props.active.type).toBe("boolean");
    });
  });

  // ── Request validation — Zod safeParse path ─────────────────────────────
  describe("Request validation — Zod safeParse", () => {
    it("should validate z.coerce.date() from string input", () => {
      const schema = z.object({ expiresAt: z.coerce.date() });
      const req = new Request();
      req.body = { expiresAt: "2024-01-01T12:00:00Z" };
      const result = req.validate(schema, true);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });
});
