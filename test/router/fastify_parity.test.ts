import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toJSONSchema, $ZodRegistry, $ZodType } from "zod/v4/core";
import { ZodLoader } from "../../src/validator/zod_loader.js";

/**
 * ── Fastify @fastify/type-provider-zod replication ──────────────────────
 * Copied verbatim from the package's source (zod-to-json.js + errors.js)
 * so we can assert byte-identical JSON Schema output against the standard.
 */
function isZodDate(e: any): boolean {
  return e instanceof $ZodType && e._zod.def.type === "date";
}
function isZodUnion(e: any): boolean {
  return e instanceof $ZodType && e._zod.def.type === "union";
}
function isZodUndefined(e: any): boolean {
  return e instanceof $ZodType && e._zod.def.type === "undefined";
}
function getOverride(ctx: any, io: string) {
  if (isZodUnion(ctx.zodSchema))
    ctx.jsonSchema.anyOf = ctx.jsonSchema.anyOf?.filter(
      (s: object) => Object.keys(s).length > 0,
    );
  if (isZodDate(ctx.zodSchema) && io === "output") {
    ctx.jsonSchema.type = "string";
    ctx.jsonSchema.format = "date-time";
  }
  if (isZodUndefined(ctx.zodSchema) && io === "output") {
    ctx.jsonSchema.type = "null";
  }
}
function fastifyToJson(zodSchema: any, io: "input" | "output"): object {
  const reg = new $ZodRegistry();
  reg.add(zodSchema, { id: "test" });
  const { schemas } = toJSONSchema(reg, {
    io,
    target: "openapi-3.0",
    unrepresentable: "any",
    cycles: "ref",
    reused: "inline",
    override: (ctx: any) => getOverride(ctx, io),
  });
  const obj = { ...(schemas as any).test };
  delete obj.id;
  delete obj.$schema;
  delete obj.$id;
  return obj;
}

// ── Edge-case schema catalogue ──────────────────────────────────────────
const cases: [string, z.ZodTypeAny][] = [
  // Refinements
  [
    "refine",
    z.object({ age: z.number().refine((v) => v >= 0, "must be positive") }),
  ],
  [
    "superRefine",
    z.object({
      pass: z.string().superRefine((val, ctx) => {
        if (val.length < 8)
          ctx.addIssue({ code: "custom", message: "too short" });
      }),
    }),
  ],
  [
    "multiple refine",
    z.object({
      n: z
        .number()
        .refine((v) => v > 0)
        .refine((v) => v < 100),
    }),
  ],
  [
    "refine with transform",
    z.object({
      val: z
        .string()
        .transform((s) => s.length)
        .refine((v) => v > 0),
    }),
  ],

  // Transforms
  ["transform basic", z.object({ page: z.string().transform(Number) })],
  [
    "transform with preprocess",
    z.object({ val: z.preprocess((v) => String(v), z.string()) }),
  ],
  [
    "transform complex",
    z.object({ date: z.string().transform((s) => new Date(s)) }),
  ],
  ["pipe", z.object({ val: z.string().pipe(z.coerce.number()) })],
  [
    "optional transform",
    z.object({ page: z.string().transform(Number).optional() }),
  ],
  [
    "nullable transform",
    z.object({ page: z.string().transform(Number).nullable() }),
  ],
  [
    "default transform",
    z.object({ page: z.string().transform(Number).default("0") }),
  ],
  [
    "array of transform",
    z.object({ pages: z.array(z.string().transform(Number)) }),
  ],
  [
    "nested object with transform",
    z.object({ outer: z.object({ inner: z.string().transform(Number) }) }),
  ],

  // Coercions
  ["coerce.number", z.object({ n: z.coerce.number() })],
  ["coerce.boolean", z.object({ b: z.coerce.boolean() })],
  ["coerce.bigint", z.object({ bi: z.coerce.bigint() })],
  ["coerce.date", z.object({ d: z.coerce.date() })],

  // Dates
  ["plain date", z.object({ d: z.date() })],
  ["date.min", z.object({ d: z.date().min(new Date("2020-01-01")) })],
  ["date.max", z.object({ d: z.date().max(new Date("2030-01-01")) })],
  [
    "date.range",
    z.object({
      d: z.date().min(new Date("2020-01-01")).max(new Date("2030-01-01")),
    }),
  ],
  ["array of date", z.object({ dates: z.array(z.coerce.date()) })],
  ["optional date", z.object({ d: z.coerce.date().optional() })],
  ["nullable date", z.object({ d: z.date().nullable() })],
  ["nullish date", z.object({ d: z.coerce.date().nullish() })],
  [
    "default date",
    z.object({ d: z.coerce.date().default(new Date("2020-01-01")) }),
  ],
  [
    "record of date",
    z.object({ dates: z.record(z.string(), z.coerce.date()) }),
  ],
  ["map of date", z.object({ dates: z.map(z.string(), z.coerce.date()) })],

  // Unions
  [
    "union string/date",
    z.object({ val: z.union([z.string(), z.coerce.date()]) }),
  ],
  [
    "discriminated union",
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), value: z.string() }),
      z.object({ type: z.literal("b"), value: z.number() }),
    ]),
  ],
  [
    "optional union with date",
    z.object({ val: z.union([z.string(), z.coerce.date()]).optional() }),
  ],

  // Intersection
  [
    "intersection",
    z.object({
      a: z.intersection(
        z.object({ x: z.string() }),
        z.object({ y: z.number() }),
      ),
    }),
  ],

  // Literals
  ["literal string", z.object({ kind: z.literal("movie") })],
  ["literal number", z.object({ count: z.literal(42) })],
  ["literal null", z.object({ val: z.literal(null) })],
  ["literal boolean", z.object({ val: z.literal(true) })],

  // Enums
  ["enum", z.object({ color: z.enum(["red", "green", "blue"]) })],
  [
    "nativeEnum",
    z.object({
      status: z.nativeEnum({ ACTIVE: "active", INACTIVE: "inactive" }),
    }),
  ],

  // Special types
  ["any", z.object({ data: z.any() })],
  ["unknown", z.object({ data: z.unknown() })],
  ["never", z.object({ data: z.never() })],
  ["void", z.object({ data: z.void() })],
  ["undefined", z.object({ data: z.undefined() })],
  ["null", z.object({ data: z.null() })],
  ["nan", z.object({ data: z.nan() })],
  ["bigint", z.object({ data: z.bigint() })],

  // Branding / readonly
  ["branded string", z.object({ id: z.string().brand("UUID") })],
  ["readonly string", z.object({ id: z.string().readonly() })],
  ["readonly date", z.object({ d: z.date().readonly() })],

  // Catch / prefault
  ["catch string", z.object({ val: z.string().catch("fallback") })],
  [
    "catch date",
    z.object({ d: z.coerce.date().catch(new Date("2020-01-01")) }),
  ],
  ["prefault", z.object({ val: z.string().prefault("default") })],

  // Tuples
  ["tuple", z.object({ pair: z.tuple([z.string(), z.number()]) })],
  [
    "tuple with date",
    z.object({ pair: z.tuple([z.string(), z.coerce.date()]) }),
  ],

  // Lazy
  ["lazy", z.object({ val: z.lazy(() => z.string()) })],
  ["lazy date", z.object({ d: z.lazy(() => z.coerce.date()) })],

  // Meta / describe
  ["meta", z.object({ id: z.string().meta({ description: "The ID" }) })],
  [
    "meta date",
    z.object({ d: z.coerce.date().meta({ description: "Expiry" }) }),
  ],
  ["describe", z.object({ name: z.string().describe("User name") })],

  // String formats
  ["email", z.object({ email: z.string().email() })],
  ["url", z.object({ url: z.string().url() })],
  ["uuid", z.object({ id: z.string().uuid() })],
  ["datetime", z.object({ d: z.string().datetime() })],

  // Numbers
  ["int", z.object({ n: z.number().int() })],
  ["min", z.object({ n: z.number().min(0) })],
  ["max", z.object({ n: z.number().max(100) })],
  ["positive", z.object({ n: z.number().positive() })],
  ["multipleOf", z.object({ n: z.number().multipleOf(5) })],
  ["finite", z.object({ n: z.number().finite() })],

  // Strings
  ["minLength", z.object({ s: z.string().min(3) })],
  ["maxLength", z.object({ s: z.string().max(10) })],
  ["regex", z.object({ s: z.string().regex(/^\d+$/) })],
  ["startsWith", z.object({ s: z.string().startsWith("foo") })],
  ["endsWith", z.object({ s: z.string().endsWith("bar") })],
  ["nonEmpty", z.object({ s: z.string().nonempty() })],

  // Arrays
  ["array min", z.object({ arr: z.array(z.string()).min(1) })],
  ["array max", z.object({ arr: z.array(z.string()).max(10) })],
  ["array length", z.object({ arr: z.array(z.string()).length(3) })],

  // Sets
  ["set", z.object({ tags: z.set(z.string()) })],
  ["set min", z.object({ tags: z.set(z.string()).min(1) })],
  ["set of date", z.object({ dates: z.set(z.coerce.date()) })],

  // Simple baseline
  [
    "simple",
    z.object({ name: z.string(), age: z.number(), active: z.boolean() }),
  ],
];

describe("Fastify @fastify/type-provider-zod parity (all edge cases)", () => {
  for (const [label, schema] of cases) {
    for (const io of ["input", "output"] as const) {
      it(`${label} — io: ${io}`, () => {
        const fastifyResult = fastifyToJson(schema, io);
        const baldaResult = ZodLoader.toJSONSchema(schema, { io });
        // Strip $schema from balda (Fastify strips it)
        const baldaNorm = { ...baldaResult };
        delete (baldaNorm as any).$schema;

        expect(baldaNorm).toEqual(fastifyResult);
      });
    }
  }
});
