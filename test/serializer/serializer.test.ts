import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { serializer } from "../../src/serializer/serializer.js";
import type { SerializerBuilder } from "../../src/serializer/serializer_types.js";

type WidenBuilder<T> = SerializerBuilder<T, string, Record<string, unknown>>;

describe("serializer", () => {
  it("should transform data using a single variant with no schema", async () => {
    const result = await serializer()
      .defineVariant("default", (u: { id: number; name: string }) => ({
        id: u.id,
        name: u.name,
      }))
      .useVariant("default", { id: 1, name: "Alice" });

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should support multiple variants and call the correct one", async () => {
    type User = { id: number; name: string; email: string; role: string };

    const builder = serializer<User>()
      .defineVariant("basic", (u) => ({ id: u.id }))
      .defineVariant("full", (u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    const basic = await builder.useVariant("basic", {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });
    expect(basic).toEqual({ id: 1 });

    const full = await builder.useVariant("full", {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });
    expect(full).toEqual({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });
  });

  it("should throw a descriptive error for an undefined variant", async () => {
    const builder = serializer<{ id: number }>().defineVariant(
      "default",
      (u) => ({
        id: u.id,
      }),
    );

    await expect(
      (builder as unknown as WidenBuilder<{ id: number }>).useVariant(
        "nonexistent",
        { id: 1 },
      ),
    ).rejects.toThrow(
      'Serializer variant "nonexistent" is not defined. Defined variants: default',
    );
  });

  it("should list all defined variants in the error message", async () => {
    const builder = serializer<{ id: number }>()
      .defineVariant("basic", (u) => ({ id: u.id }))
      .defineVariant("detailed", (u) => ({ id: u.id }));

    await expect(
      (builder as unknown as WidenBuilder<{ id: number }>).useVariant(
        "missing",
        { id: 1 },
      ),
    ).rejects.toThrow("Defined variants: basic, detailed");
  });

  it("should await async handlers", async () => {
    const result = await serializer()
      .defineVariant("async", async (u: { id: number; name: string }) => {
        await Promise.resolve();
        return { id: u.id, name: u.name.toUpperCase() };
      })
      .useVariant("async", { id: 1, name: "Alice" });

    expect(result).toEqual({ id: 1, name: "ALICE" });
  });

  it("should have type `never` for useVariant key when no variants are defined", () => {
    const _typeCheck = () => {
      // @ts-expect-error — no variants defined, key should be `never`
      serializer().useVariant("anything", {});
    };
    expect(_typeCheck).toBeDefined();
  });

  it("should only accept declared variant names at the type level", () => {
    const _typeCheck = () => {
      const builder = serializer<{ id: number }>()
        .defineVariant("basic", (u) => ({ id: u.id }))
        .defineVariant("detailed", (u) => ({ id: u.id }));

      builder.useVariant("basic", { id: 1 });
      builder.useVariant("detailed", { id: 1 });

      // @ts-expect-error — 'admin' is not a declared variant
      builder.useVariant("admin", { id: 1 });
    };
    expect(_typeCheck).toBeDefined();
  });

  it("should return raw handler output when validate is false (default)", async () => {
    const { z } = await import("zod");
    const StrictSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    const result = await serializer()
      .defineVariant(
        "raw",
        (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
        StrictSchema,
      )
      .useVariant("raw", { id: 1, name: "Alice" });

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should share different data across calls", async () => {
    const builder = serializer<{ id: number }>()
      .defineVariant("a", (u) => u.id)
      .defineVariant("b", (u) => u.id * 2);

    expect(await builder.useVariant("a", { id: 42 })).toBe(42);
    expect(await builder.useVariant("b", { id: 10 })).toBe(20);
  });
});

describe("validate: true", () => {
  it("should validate output against a Zod schema when validate is true", async () => {
    const { z } = await import("zod");
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const result = await serializer()
      .defineVariant(
        "validated",
        UserSchema,
        (u: { id: number; name: string; internal: string }) => ({
          id: u.id,
          name: u.name,
        }),
      )
      .useVariant(
        "validated",
        { id: 1, name: "Alice", internal: "secret" },
        { validate: true },
      );

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when Zod validation fails with validate true", async () => {
    const { z } = await import("zod");
    const StrictSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    await expect(
      serializer()
        .defineVariant(
          "validated",
          (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
          StrictSchema,
        )
        .useVariant("validated", { id: 1, name: "Alice" }, { validate: true }),
    ).rejects.toThrow();
  });

  it("should validate output against a TypeBox schema when validate is true", async () => {
    const UserSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
    });

    const result = await serializer()
      .defineVariant(
        "validated",
        UserSchema,
        (u: { id: number; name: string; internal: string }) => ({
          id: u.id,
          name: u.name,
        }),
      )
      .useVariant(
        "validated",
        { id: 1, name: "Alice", internal: "secret" },
        { validate: true },
      );

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when TypeBox validation fails with validate true", async () => {
    const StrictSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String({ format: "email" }),
    });

    await expect(
      serializer()
        .defineVariant(
          "validated",
          (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
          StrictSchema,
        )
        .useVariant("validated", { id: 1, name: "Alice" }, { validate: true }),
    ).rejects.toThrow("Serializer validation failed");
  });

  it("should validate output against a JSON Schema when validate is true", async () => {
    const JsonSchema = {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
        name: { type: "string" as const },
      },
      required: ["id", "name"],
      additionalProperties: false,
    };

    const result = await serializer()
      .defineVariant(
        "validated",
        JsonSchema,
        (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
      )
      .useVariant("validated", { id: 1, name: "Alice" }, { validate: true });

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when JSON Schema validation fails with validate true", async () => {
    const JsonSchema = {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
        name: { type: "string" as const },
        email: { type: "string" as const },
      },
      required: ["id", "name", "email"],
      additionalProperties: false,
    };

    await expect(
      serializer()
        .defineVariant(
          "validated",
          (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
          JsonSchema,
        )
        .useVariant("validated", { id: 1, name: "Alice" }, { validate: true }),
    ).rejects.toThrow();
  });
});

describe("validate: false (default) — schema as type guard only", () => {
  it("should NOT validate at runtime when validate is false even with Zod schema", async () => {
    const { z } = await import("zod");
    const StrictSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    const result = await serializer()
      .defineVariant(
        "no-validate",
        (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
        StrictSchema,
      )
      .useVariant("no-validate", { id: 1, name: "Alice" });

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should NOT validate at runtime when validate is false even with TypeBox schema", async () => {
    const StrictSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String({ format: "email" }),
    });

    const result = await serializer()
      .defineVariant(
        "no-validate",
        (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
        StrictSchema,
      )
      .useVariant("no-validate", { id: 1, name: "Alice" });

    expect(result).toEqual({ id: 1, name: "Alice" });
  });
});
