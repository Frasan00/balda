import { expect, test } from "vitest";
import { serializer } from "../../src/serializer/serializer.js";
import { z } from "zod";

test("should pass ctx to variant handler", async () => {
  const s = serializer<string, { userId: string }>();
  const s2 = s.defineVariant(
    "test",
    (input: string, ctx) => `${input}-${ctx?.userId}`,
  );

  const result = await s2.useVariant("test", "hello", {
    ctx: { userId: "123" },
  });
  expect(result).toBe("hello-123");
});

test("should infer context type from schema", async () => {
  const s = serializer(
    z.object({ id: z.string() }),
    z.object({ userId: z.string(), role: z.enum(["admin", "user"]) }),
  );
  const s2 = s.defineVariant("test", (input, ctx) => ({
    ...input,
    user: ctx?.userId,
  }));

  const result = await s2.useVariant(
    "test",
    { id: "123" },
    { ctx: { userId: "456", role: "admin" } },
  );
  expect(result).toEqual({ id: "123", user: "456" });
});

test("should pass nested context schema to handler", async () => {
  const s = serializer(
    z.object({ id: z.string() }),
    z.object({ ctx: z.object({ test: z.string() }) }),
  );
  const s2 = s.defineVariant(
    "test",
    (input, ctx) => `${input.id}-${ctx?.ctx?.test}`,
  );

  const result = await s2.useVariant(
    "test",
    { id: "1" },
    { ctx: { ctx: { test: "value" } } },
  );
  expect(result).toBe("1-value");
});

test("should work without ctx option", async () => {
  const s = serializer<string, { userId: string }>();
  const s2 = s.defineVariant(
    "test",
    (input: string, ctx) => `${input}-${ctx?.userId ?? "anonymous"}`,
  );

  const result = await s2.useVariant("test", "hello");
  expect(result).toBe("hello-anonymous");
});

test("should work with schema and ctx", async () => {
  const s = serializer(
    z.object({ message: z.string() }),
    z.object({ userId: z.string() }),
  );
  const s2 = s.defineVariant(
    "test",
    z.object({ result: z.string() }),
    (input, ctx) => ({
      result: `${input.message}-${ctx?.userId ?? "unknown"}`,
    }),
  );

  const result = await s2.useVariant(
    "test",
    { message: "hi" },
    { ctx: { userId: "123" } },
  );
  expect(result).toEqual({ result: "hi-123" });
});

test("should infer context type in variant handler", async () => {
  const s = serializer<string, { counter: number }>();
  const s2 = s.defineVariant("test", (input, ctx) => {
    const count = ctx?.counter ?? 0;
    return input.repeat(count + 1);
  });

  const result = await s2.useVariant("test", "a", { ctx: { counter: 2 } });
  expect(result).toBe("aaa");
});
