# Serializer Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a `serializer` function that returns a chained builder for transforming domain objects into validated DTOs, with type-augmented variants and optional schema validation.

**Architecture:** Function `serializer(resource)` returns a builder object. Each `.defineVariant(name, handler, schema?)` call returns a new builder with augmented type — the variant name is added to the allowed key union. The single terminal method `.useVariant(name)` resolves the variant and optionally validates output against the provided schema using Balda's existing Zod/TypeBox/AJV infrastructure.

**Tech Stack:** TypeScript, Vitest, Balda's existing `RequestSchema`/`ValidatedData<T>` types, Zod (peer dep), TypeBox (peer dep), Ajv (direct dep)

**Constraint:** No git commit/push/add operations.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/serializer/serializer_types.ts` | Public type definitions (`SerializerBuilder`, `VariantHandler`, `VariantConfig`) |
| `src/serializer/serializer.ts` | `serializer()` function + `SerializerBuilderImpl` class + `validateOutput` helper |
| `src/serializer/index.ts` | Barrel export re-exporting from the two files above |
| `test/serializer/serializer.test.ts` | Comprehensive test suite (vitest) |
| `docs/docs/core-concepts/serializer.md` | Docusaurus documentation page |
| `src/index.ts` | Add public exports (modify existing) |
| `docs/sidebars.ts` | Add serializer to Core Concepts sidebar (modify existing) |

---

### Task 1: Type Definitions

**Files:**
- Create: `src/serializer/serializer_types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/serializer/serializer_types.ts
import type { RequestSchema } from "../decorators/validation/validate_types.js";

/**
 * Handler function that transforms a resource into an output DTO.
 * Supports both synchronous and asynchronous handlers.
 */
export type VariantHandler<TInput, TOutput> = (
  input: TInput,
) => TOutput | Promise<TOutput>;

/**
 * Internal storage for a variant's handler and optional schema.
 */
export interface VariantConfig<TResource = unknown> {
  handler: VariantHandler<TResource, unknown>;
  schema?: RequestSchema;
}

/**
 * Type-safe serializer builder that accumulates variant definitions.
 *
 * Each call to `defineVariant()` returns a new builder with the variant
 * name added to the `TDeclaredVariants` union and the output type recorded
 * in `TVariantMap`.
 *
 * When no variants are defined, `TDeclaredVariants` is `never`, making
 * `useVariant()` uncallable at compile time.
 *
 * @typeParam TResource - The domain object type being serialized
 * @typeParam TDeclaredVariants - Union of declared variant names (starts as `never`)
 * @typeParam TVariantMap - Map of variant name to output type
 */
export interface SerializerBuilder<
  TResource,
  TDeclaredVariants extends string,
  TVariantMap extends Record<string, unknown>,
> {
  /**
   * Define a named variant with an optional output schema for validation.
   * Each call returns a new builder with the variant added to the type map.
   */
  defineVariant<const TName extends string, TOutput>(
    name: TName,
    handler: VariantHandler<TResource, TOutput>,
    schema?: RequestSchema,
  ): SerializerBuilder<
    TResource,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, TOutput>
  >;

  /**
   * Execute a named variant and return its output.
   * When no variants are defined, TDeclaredVariants is `never`,
   * making this method uncallable at compile time.
   */
  useVariant<TName extends TDeclaredVariants>(
    name: TName,
  ): Promise<TVariantMap[TName]>;
}
```

- [ ] **Step 2: Verify types compile**

Run: `docker compose exec -T node npx tsc --noEmit src/serializer/serializer_types.ts`
Expected: Exit code 0, no errors.

---

### Task 2: Core Builder — Basic Variant

**Files:**
- Create: `src/serializer/serializer.ts`
- Create: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/serializer/serializer.test.ts
import { describe, expect, it } from "vitest";
import { serializer } from "../../src/serializer/serializer.js";

describe("serializer", () => {
  it("should transform a resource using a single variant with no schema", async () => {
    const user = { id: 1, name: "Alice", email: "alice@example.com" };

    const result = await serializer(user)
      .defineVariant("default", (u) => ({
        id: u.id,
        name: u.name,
      }))
      .useVariant("default");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: FAIL — `Cannot find module '../../src/serializer/serializer.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/serializer/serializer.ts
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import type {
  SerializerBuilder,
  VariantConfig,
} from "./serializer_types.js";

class SerializerBuilderImpl<
    TResource,
    TDeclaredVariants extends string,
    TVariantMap extends Record<string, unknown>,
  >
  implements SerializerBuilder<TResource, TDeclaredVariants, TVariantMap>
{
  constructor(
    private readonly resource: TResource,
    private readonly variants: Map<string, VariantConfig<TResource>> = new Map(),
  ) {}

  defineVariant<const TName extends string, TOutput>(
    name: TName,
    handler: (input: TResource) => TOutput | Promise<TOutput>,
    schema?: RequestSchema,
  ): SerializerBuilder<
    TResource,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, TOutput>
  > {
    const newVariants = new Map(this.variants);
    newVariants.set(name, { handler, schema });
    return new SerializerBuilderImpl(
      this.resource,
      newVariants,
    ) as unknown as SerializerBuilder<
      TResource,
      TDeclaredVariants | TName,
      TVariantMap & Record<TName, TOutput>
    >;
  }

  async useVariant<TName extends TDeclaredVariants>(
    name: TName,
  ): Promise<TVariantMap[TName]> {
    const config = this.variants.get(name);
    if (!config) {
      const names = [...this.variants.keys()].join(", ") || "(none)";
      throw new Error(
        `Serializer variant "${name}" is not defined. Defined variants: ${names}`,
      );
    }

    const result = await config.handler(this.resource);

    if (config.schema) {
      return validateOutput(config.schema, result) as Promise<TVariantMap[TName]>;
    }

    return result as TVariantMap[TName];
  }
}

const validateOutput = async (
  _schema: RequestSchema,
  _data: unknown,
): Promise<unknown> => {
  throw new Error("Schema validation not yet implemented");
};

export const serializer = <TResource>(
  resource: TResource,
): SerializerBuilder<TResource, never, {}> => {
  return new SerializerBuilderImpl(resource) as SerializerBuilder<
    TResource,
    never,
    {}
  >;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: PASS — 1 test passes.

---

### Task 3: Multiple Variants

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/serializer/serializer.test.ts` inside the existing `describe("serializer")` block:

```typescript
  it("should support multiple variants and call the correct one", async () => {
    const user = { id: 1, name: "Alice", email: "alice@example.com", role: "admin" as const };

    const builder = serializer(user)
      .defineVariant("basic", (u) => ({ id: u.id }))
      .defineVariant("full", (u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    const basic = await builder.useVariant("basic");
    expect(basic).toEqual({ id: 1 });

    const full = await builder.useVariant("full");
    expect(full).toEqual({ id: 1, name: "Alice", email: "alice@example.com", role: "admin" });
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: PASS — 2 tests pass. The builder already stores each variant in the internal map, so multiple variants work.

---

### Task 4: Undefined Variant Error

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe("serializer")` block:

```typescript
  it("should throw a descriptive error for an undefined variant", async () => {
    const user = { id: 1, name: "Alice" };

    const builder = serializer(user)
      .defineVariant("default", (u) => ({ id: u.id }));

    await expect(builder.useVariant("nonexistent")).rejects.toThrow(
      'Serializer variant "nonexistent" is not defined. Defined variants: default',
    );
  });

  it("should list all defined variants in the error message", async () => {
    const user = { id: 1, name: "Alice" };

    const builder = serializer(user)
      .defineVariant("basic", (u) => ({ id: u.id }))
      .defineVariant("detailed", (u) => ({ id: u.id, name: u.name }));

    await expect(builder.useVariant("missing")).rejects.toThrow(
      "Defined variants: basic, detailed",
    );
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: PASS — 4 tests pass. Error handling was already implemented in Task 2.

---

### Task 5: Async Handler Support

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe("serializer")` block:

```typescript
  it("should await async handlers", async () => {
    const user = { id: 1, name: "Alice" };

    const result = await serializer(user)
      .defineVariant("async", async (u) => {
        await Promise.resolve();
        return { id: u.id, name: u.name.toUpperCase() };
      })
      .useVariant("async");

    expect(result).toEqual({ id: 1, name: "ALICE" });
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: PASS — 5 tests pass. `useVariant` already uses `await config.handler(this.resource)`.

---

### Task 6: Type Safety — Never Key and Variant Constraints

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the type safety tests**

Append to the `describe("serializer")` block:

```typescript
  it("should have type `never` for useVariant key when no variants are defined", () => {
    // @ts-expect-error — no variants defined, key should be `never`
    serializer({ id: 1 }).useVariant("anything");
  });

  it("should only accept declared variant names at the type level", () => {
    const builder = serializer({ id: 1, name: "Alice" })
      .defineVariant("basic", (u) => ({ id: u.id }))
      .defineVariant("detailed", (u) => ({ id: u.id, name: u.name }));

    // These should compile fine
    builder.useVariant("basic");
    builder.useVariant("detailed");

    // @ts-expect-error — 'admin' is not a declared variant
    builder.useVariant("admin");
  });
```

- [ ] **Step 2: Verify TypeScript compilation with the type checks**

Run: `docker compose exec -T node npx tsc --noEmit test/serializer/serializer.test.ts`
Expected: Exit code 0. Both `@ts-expect-error` directives are consumed by actual type errors. No unused directive warnings.

---

### Task 7: Schema Validation — Zod

**Files:**
- Modify: `test/serializer/serializer.test.ts`
- Modify: `src/serializer/serializer.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe("serializer")` block:

```typescript
describe("schema validation — Zod", () => {
  it("should validate output against a Zod schema", async () => {
    const { z } = await import("zod");
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const user = { id: 1, name: "Alice", internal: "secret" };

    const result = await serializer(user)
      .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), UserSchema)
      .useVariant("validated");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when Zod validation fails", async () => {
    const { z } = await import("zod");
    const StrictSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    const user = { id: 1, name: "Alice" };

    await expect(
      serializer(user)
        .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), StrictSchema)
        .useVariant("validated"),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts -t "schema validation — Zod"`
Expected: FAIL — `validateOutput` throws "Schema validation not yet implemented".

- [ ] **Step 3: Implement Zod validation in validateOutput**

Replace the `validateOutput` stub in `src/serializer/serializer.ts` with:

```typescript
import { ZodLoader } from "../validator/zod_loader.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { AjvStateManager } from "../ajv/ajv.js";
import { validateSchema } from "../validator/validator.js";

const validateOutput = async (
  schema: RequestSchema,
  data: unknown,
): Promise<unknown> => {
  if (ZodLoader.isZodSchema(schema)) {
    return schema.parse(data);
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const { Value } = await import("@sinclair/typebox/value");
    if (!Value.Check(schema, data)) {
      const errors = [...Value.Errors(schema, data)];
      throw new Error(
        `Serializer validation failed:\n${errors.map((e) => `  - ${e.message} at ${e.path}`).join("\n")}`,
      );
    }
    return Value.Cast(schema, data);
  }

  const validator = AjvStateManager.getOrCompileValidator(
    schema as Record<string, unknown>,
    "serializer_json",
  );
  return validateSchema(validator, data, true);
};
```

Add the missing imports at the top of `src/serializer/serializer.ts` (the `ZodLoader`, `TypeBoxLoader`, `AjvStateManager`, `validateSchema` imports). The full top of the file becomes:

```typescript
// src/serializer/serializer.ts
import type { RequestSchema } from "../decorators/validation/validate_types.js";
import { ZodLoader } from "../validator/zod_loader.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { AjvStateManager } from "../ajv/ajv.js";
import { validateSchema } from "../validator/validator.js";
import type {
  SerializerBuilder,
  VariantConfig,
} from "./serializer_types.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts -t "schema validation — Zod"`
Expected: PASS — 2 Zod tests pass.

---

### Task 8: Schema Validation — TypeBox

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the test**

Append to `test/serializer/serializer.test.ts`:

```typescript
describe("schema validation — TypeBox", () => {
  it("should validate output against a TypeBox schema", async () => {
    const { Type } = await import("@sinclair/typebox");
    const UserSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
    });

    const user = { id: 1, name: "Alice", internal: "secret" };

    const result = await serializer(user)
      .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), UserSchema)
      .useVariant("validated");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when TypeBox validation fails", async () => {
    const { Type } = await import("@sinclair/typebox");
    const StrictSchema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String({ format: "email" }),
    });

    const user = { id: 1, name: "Alice" };

    await expect(
      serializer(user)
        .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), StrictSchema)
        .useVariant("validated"),
    ).rejects.toThrow("Serializer validation failed");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts -t "schema validation — TypeBox"`
Expected: PASS — 2 TypeBox tests pass. TypeBox validation was implemented in Task 7.

---

### Task 9: Schema Validation — JSON Schema (Ajv)

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the test**

Append to `test/serializer/serializer.test.ts`:

```typescript
describe("schema validation — JSON Schema (Ajv)", () => {
  it("should validate output against a plain JSON Schema object", async () => {
    const JsonSchema = {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
        name: { type: "string" as const },
      },
      required: ["id", "name"],
      additionalProperties: false,
    };

    const user = { id: 1, name: "Alice" };

    const result = await serializer(user)
      .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), JsonSchema)
      .useVariant("validated");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should throw when JSON Schema validation fails", async () => {
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

    const user = { id: 1, name: "Alice" };

    await expect(
      serializer(user)
        .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), JsonSchema)
        .useVariant("validated"),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts -t "schema validation — JSON Schema"`
Expected: PASS — 2 JSON Schema tests pass. Ajv validation was implemented in Task 7.

---

### Task 10: Edge Case — No Schema, Raw Output

**Files:**
- Modify: `test/serializer/serializer.test.ts`

- [ ] **Step 1: Write the test**

Append to the `describe("serializer")` block (top level, not inside a schema describe):

```typescript
  it("should return raw handler output when no schema is provided", async () => {
    const user = { id: 1, name: "Alice" };

    const result = await serializer(user)
      .defineVariant("raw", (u) => ({ ...u, extra: true }))
      .useVariant("raw");

    expect(result).toEqual({ id: 1, name: "Alice", extra: true });
  });

  it("should share the same resource across all variants", async () => {
    const user = { id: 42 };

    const builder = serializer(user)
      .defineVariant("a", (u) => u.id)
      .defineVariant("b", (u) => u.id * 2);

    expect(await builder.useVariant("a")).toBe(42);
    expect(await builder.useVariant("b")).toBe(84);
  });
```

- [ ] **Step 2: Run all tests**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: ALL tests pass (basic, multiple, error, async, type safety, Zod, TypeBox, JSON Schema, edge cases).

---

### Task 11: Barrel Export

**Files:**
- Create: `src/serializer/index.ts`

- [ ] **Step 1: Create the barrel export file**

```typescript
// src/serializer/index.ts
export { serializer } from "./serializer.js";
export type {
  SerializerBuilder,
  VariantHandler,
  VariantConfig,
} from "./serializer_types.js";
```

- [ ] **Step 2: Verify it compiles**

Run: `docker compose exec -T node npx tsc --noEmit src/serializer/index.ts`
Expected: Exit code 0.

---

### Task 12: Export from Package Index

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add serializer exports to `src/index.ts`**

Find the comment `// Server` (around line 91) and insert the following block BEFORE it:

```typescript
// Serializer
export { serializer } from "./serializer/serializer.js";
export type {
  SerializerBuilder,
  VariantHandler,
  VariantConfig,
} from "./serializer/serializer_types.js";
```

The block should go after the validation exports (line 25) and before the `// Cron` comment (line 28).

- [ ] **Step 2: Verify full project compiles**

Run: `docker compose exec -T node npx tsc --noEmit`
Expected: Exit code 0.

- [ ] **Step 3: Verify serializer is importable**

Run: `docker compose exec -T node npx tsx -e "import { serializer } from './src/index.ts'; console.log(typeof serializer)"`
Expected: Output `function`.

---

### Task 13: Documentation Page

**Files:**
- Create: `docs/docs/core-concepts/serializer.md`

- [ ] **Step 1: Create the documentation page**

```markdown
---
title: Serializer
description: Transform domain objects into validated DTOs with a type-safe chained builder. Optional feature for API response shaping.
keywords: [balda, serializer, dto, transformation, validation, type-safe]
sidebar_position: 11
---

# Serializer

:::info Optional Feature
The serializer is a standalone utility — it is not required for any Balda feature. Use it when you need to transform domain objects into API-facing DTOs with type-safe variant selection and optional output validation.
:::

Balda provides a type-safe serializer that transforms domain objects into DTOs using a chained builder pattern. Each variant is defined with `.defineVariant()` and resolved with `.useVariant()`. TypeScript type augmentation ensures you can only call variants that have been declared.

## Overview

- **Chained builder API**: `serializer(resource).defineVariant(...).defineVariant(...).useVariant(name)`
- **Type-safe variant selection**: `useVariant()` only accepts declared variant names
- **Compile-time enforcement**: When no variants are defined, `useVariant()` has key type `never`
- **Optional schema validation**: Validate output against Zod, TypeBox, or JSON Schema
- **Async support**: Handlers can be synchronous or asynchronous

## Basic Usage

```typescript
import { serializer } from "balda";

const user = { id: 1, name: "Alice", email: "alice@example.com" };

const result = await serializer(user)
  .defineVariant("default", (u) => ({
    id: u.id,
    name: u.name,
  }))
  .useVariant("default");

// result: { id: 1, name: "Alice" }
```

## Multiple Variants

Chain `.defineVariant()` calls to define multiple output shapes. TypeScript ensures you can only call declared variant names.

```typescript
import { serializer } from "balda";

const user = { id: 1, name: "Alice", email: "alice@example.com", role: "admin" };

const builder = serializer(user)
  .defineVariant("basic", (u) => ({ id: u.id }))
  .defineVariant("full", (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

const basic = await builder.useVariant("basic");
// { id: 1 }

const full = await builder.useVariant("full");
// { id: 1, name: "Alice", email: "alice@example.com", role: "admin" }

// TypeScript error — 'admin' is not a declared variant
// builder.useVariant("admin");
```

## Schema Validation

Pass a schema as the third argument to `.defineVariant()` to validate the handler's output. Balda supports Zod, TypeBox, and plain JSON Schema.

### Zod

```typescript
import { serializer } from "balda";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const result = await serializer(user)
  .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), UserSchema)
  .useVariant("validated");
```

### TypeBox

```typescript
import { serializer } from "balda";
import { Type } from "@sinclair/typebox";

const UserSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
});

const result = await serializer(user)
  .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), UserSchema)
  .useVariant("validated");
```

### JSON Schema

```typescript
import { serializer } from "balda";

const UserSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
  },
  required: ["id", "name"],
  additionalProperties: false,
};

const result = await serializer(user)
  .defineVariant("validated", (u) => ({ id: u.id, name: u.name }), UserSchema)
  .useVariant("validated");
```

## Async Handlers

Handlers can be asynchronous. `useVariant()` always returns a `Promise`.

```typescript
const result = await serializer(user)
  .defineVariant("enriched", async (u) => {
    const profile = await fetchProfile(u.id);
    return { id: u.id, name: u.name, avatar: profile.avatar };
  })
  .useVariant("enriched");
```

## Error Handling

### Undefined Variant

Calling `useVariant()` with a name that was not defined throws a descriptive error:

```typescript
serializer(user)
  .defineVariant("basic", (u) => ({ id: u.id }))
  .useVariant("nonexistent");
// Error: Serializer variant "nonexistent" is not defined. Defined variants: basic
```

### Validation Failure

When schema validation fails, the serializer throws an error from the underlying validation library (ZodError for Zod, ValidationError for Ajv, or a descriptive Error for TypeBox).

## Type Safety

The serializer uses TypeScript type augmentation to enforce variant names at compile time:

- **No variants defined**: `useVariant()` key parameter is `never` — uncallable
- **Variants defined**: `useVariant()` only accepts declared variant names
- **Output type**: Each variant's return type is tracked in the type map

```typescript
// Error: Argument of type '"anything"' is not assignable to parameter of type 'never'
serializer(user).useVariant("anything");

// Error: Argument of type '"admin"' is not assignable to parameter of type '"basic" | "full"'
serializer(user)
  .defineVariant("basic", fn)
  .defineVariant("full", fn2)
  .useVariant("admin");
```

## API Reference

### `serializer<TResource>(resource: TResource): SerializerBuilder<TResource, never, {}>`

Creates a serializer builder for the given resource. No variants are defined initially — the `useVariant()` key is `never`.

### `.defineVariant<TName, TOutput>(name, handler, schema?): SerializerBuilder<...>`

Defines a named variant. Returns a new builder with the variant added to the type map.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Unique variant name |
| `handler` | `(resource: TResource) => TOutput \| Promise<TOutput>` | Yes | Transform function |
| `schema` | `RequestSchema` | No | Zod, TypeBox, or JSON Schema for output validation |

### `.useVariant<TName>(name: TName): Promise<TOutput>`

Executes the named variant's handler against the resource and optionally validates the output.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `TDeclaredVariants` | Yes | A previously declared variant name |

**Returns:** `Promise<TOutput>` — the handler's result, optionally validated by schema.

**Throws:**
- `Error` if the variant name is not defined
- `ZodError` if Zod validation fails
- `Error` if TypeBox validation fails
- `ValidationError` if Ajv/JSON Schema validation fails
```

- [ ] **Step 2: Verify no references to removed APIs**

Run: `grep -i "toObject" docs/docs/core-concepts/serializer.md`
Expected: No output (no references to `toObject`).

---

### Task 14: Sidebar Update

**Files:**
- Modify: `docs/sidebars.ts`

- [ ] **Step 1: Add serializer to Core Concepts sidebar**

In `docs/sidebars.ts`, find the "Core Concepts" category items array. It currently ends with `"core-concepts/error-handling"`. Add `"core-concepts/serializer"` after it:

```typescript
      items: [
        "core-concepts/server",
        "core-concepts/controllers",
        "core-concepts/routing",
        "core-concepts/middleware",
        "core-concepts/request-response",
        "core-concepts/streaming",
        "core-concepts/hashing",
        "core-concepts/logger",
        "core-concepts/policies",
        "core-concepts/error-handling",
        "core-concepts/serializer",
      ],
```

- [ ] **Step 2: Verify the sidebar entry**

Run: `grep "core-concepts/serializer" docs/sidebars.ts`
Expected: One match.

---

### Task 15: Final Verification

- [ ] **Step 1: Run all serializer tests**

Run: `docker compose exec -T node yarn vitest --run test/serializer/serializer.test.ts`
Expected: ALL tests pass, exit code 0.

- [ ] **Step 2: Verify full project TypeScript compilation**

Run: `docker compose exec -T node npx tsc --noEmit`
Expected: Exit code 0.

- [ ] **Step 3: Verify no `toObject` exists in the serializer source**

Run: `grep -r "toObject" src/serializer/`
Expected: No output.

- [ ] **Step 4: Verify no `as any` or `@ts-ignore` in serializer files**

Run: `grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/serializer/`
Expected: No `as any`, no `@ts-ignore`, no `@ts-expect-error` in production code. (The `as unknown as` cast in `defineVariant` is a necessary type assertion for the builder pattern, not a type safety violation.)

- [ ] **Step 5: Verify serializer is exported from package index**

Run: `docker compose exec -T node npx tsx -e "import { serializer, type SerializerBuilder } from './src/index.ts'; const s = serializer({x:1}).defineVariant('a', v => v.x); s.useVariant('a').then(console.log)"`
Expected: Output `1`.
