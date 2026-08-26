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

Balda provides a type-safe serializer that transforms data into DTOs using a chained builder pattern. Each variant is defined with `.defineVariant()` and resolved with `.useVariant(name, data)`. TypeScript type augmentation ensures you can only call variants that have been declared.

## Overview

- **Chained builder API**: `serializer(ctxSchema).defineVariant(...).useVariant(name, data, options)`
- **Data passed at call time**: The input data is provided to `useVariant()`, not at serializer definition time
- **Type-safe variant selection**: `useVariant()` only accepts declared variant names
- **Compile-time enforcement**: When no variants are defined, `useVariant()` has key type `never`
- **Context support**: Pass arbitrary context data to variant handlers via `useVariant({ ctx })`
- **Runtime validation control**: Enable validation at call time with `useVariant({ validate: true })`

## Why Validation Defaults to False

In an HTTP context, Balda's `response.send()` already handles serialization. The serializer's job is to **transform data shapes** — stripping internal fields, projecting subsets — not to re-validate what the framework already handles.

Schemas serve as **type guards**: they give you correct TypeScript inference for handler input and output types without paying the cost of runtime validation on every request.

Enable validation at call time with `useVariant({ validate: true })` when:
- Developing locally and want to catch mismatches early
- Using the serializer outside an HTTP request cycle
- The output shape must be guaranteed (e.g., writing to an external API)

## Basic Usage

```typescript
import { serializer } from "balda";

const userSerializer = serializer()
  .defineVariant("default", (u: { id: number; name: string; email: string }) => ({
    id: u.id,
    name: u.name,
  }));

const result = await userSerializer.useVariant("default", {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
});
// result: { id: 1, name: "Alice" }
```

## With Input Schema

Pass a schema to `serializer()` for automatic input type inference:

```typescript
import { serializer } from "balda";
import { z } from "zod";

const UserInputSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

const userSerializer = serializer(UserInputSchema)
  .defineVariant("default", (u) => ({
    id: u.id,
    name: u.name,
  }));

// u is typed as { id: number; name: string; email: string }
const result = await userSerializer.useVariant("default", { id: 1, name: "Alice", email: "alice@example.com" });
```

## With Context

Define a context type when creating the serializer, then pass context data at call time:

```typescript
import { serializer } from "balda";

type RequestContext = { userId: string; requestId: string };

const userSerializer = serializer<unknown, RequestContext>()
  .defineVariant("default", (u, ctx) => ({
    id: u.id,
    name: u.name,
    requestedBy: ctx?.userId,
  }));

const result = await userSerializer.useVariant("default", { id: 1, name: "Alice" }, {
  ctx: { userId: "user-123", requestId: "req-456" },
});
```

## Multiple Variants

Chain `.defineVariant()` calls to define multiple output shapes. TypeScript ensures you can only call declared variant names.

```typescript
import { serializer } from "balda";

const userSerializer = serializer()
  .defineVariant("basic", (u: { id: number; name: string }) => ({ id: u.id }))
  .defineVariant("full", (u: { id: number; name: string; email: string; role: string }) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

const basic = await userSerializer.useVariant("basic", { id: 1, name: "Alice" });
// { id: 1 }

const full = await userSerializer.useVariant("full", {
  id: 1, name: "Alice", email: "alice@example.com", role: "admin",
});
// { id: 1, name: "Alice", email: "alice@example.com", role: "admin" }

// TypeScript error — 'admin' is not a declared variant
// userSerializer.useVariant("admin", data);
```

## Schema Validation

Pass a schema as the third argument to `.defineVariant()` for type inference. By default, **no runtime validation occurs** — the schema is a type guard only.

Enable validation at call time by passing `{ validate: true }` to `useVariant()`:

### With Validation Enabled

```typescript
import { serializer } from "balda";
import { z } from "zod";

const OutputSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const userSerializer = serializer()
  .defineVariant(
    "validated",
    (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
    OutputSchema,
  );

const result = await userSerializer.useVariant("validated", { id: 1, name: "Alice" }, { validate: true });
// Runtime validation runs — throws ZodError if output doesn't match
```

### Without Validation (Default)

```typescript
const userSerializer = serializer()
  .defineVariant(
    "type-only",
    (u: { id: number; name: string }) => ({ id: u.id, name: u.name }),
    OutputSchema,
  );

const result = await userSerializer.useVariant("type-only", { id: 1, name: "Alice" });
// No runtime validation — faster, relies on HTTP layer for serialization
```

### TypeBox

```typescript
import { Type } from "@sinclair/typebox";

const OutputSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
});

const result = await serializer()
  .defineVariant("validated", handler, OutputSchema)
  .useVariant("validated", data, { validate: true });
```

### JSON Schema

```typescript
const OutputSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
  },
  required: ["id", "name"],
  additionalProperties: false,
};

const result = await serializer()
  .defineVariant("validated", handler, OutputSchema)
  .useVariant("validated", data, { validate: true });
```

## Async Handlers

Handlers can be asynchronous. `useVariant()` always returns a `Promise`.

```typescript
const result = await serializer()
  .defineVariant("enriched", async (u: { id: number }) => {
    const profile = await fetchProfile(u.id);
    return { id: u.id, avatar: profile.avatar };
  })
  .useVariant("enriched", { id: 1 });
```

## Error Handling

### Undefined Variant

Calling `useVariant()` with a name that was not defined throws a descriptive error:

```typescript
serializer().defineVariant("basic", handler).useVariant("nonexistent", data);
// Error: Serializer variant "nonexistent" is not defined. Defined variants: basic
```

### Validation Failure (validate: true only)

When `validate: true` and schema validation fails, the serializer throws an error from the underlying validation library (ZodError for Zod, ValidationError for Ajv, or a descriptive Error for TypeBox).

## Type Safety

The serializer uses TypeScript type augmentation to enforce variant names at compile time:

- **No variants defined**: `useVariant()` key parameter is `never` — uncallable
- **Variants defined**: `useVariant()` only accepts declared variant names
- **Output type**: With a schema, the return type is `ValidatedData<Schema>`; without, it's inferred from the handler

```typescript
// Error: Argument of type '"anything"' is not assignable to parameter of type 'never'
serializer().useVariant("anything", data);

// Error: Argument of type '"admin"' is not assignable to parameter of type '"basic" | "full"'
serializer().defineVariant("basic", fn).defineVariant("full", fn2).useVariant("admin", data);
```

## API Reference

### `serializer(inputSchema?, ctxSchema?): SerializerBuilder`

Creates a serializer builder. Optionally pass a schema for input type inference and a context type.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputSchema` | `RequestSchema` | No | Zod, TypeBox, or JSON Schema for input type inference |
| `ctxSchema` | Type | No | Context type for variant handlers |

### `.defineVariant(name, handler, schema?): SerializerBuilder<...>`

Defines a named variant. Returns a new builder with the variant added to the type map.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Unique variant name |
| `handler` | `(input, ctx?) => TOutput \| Promise<TOutput>` | Yes | Transform function with optional context |
| `schema` | `RequestSchema` | No | Output schema for type inference and optional validation |

### `.useVariant(name, data, options?): Promise<TOutput>`

Executes the named variant's handler against the provided data and optionally validates the output.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `TDeclaredVariants` | Yes | A previously declared variant name |
| `data` | `TInput` | Yes | The input data to transform |
| `options.ctx` | Type | No | Context data to pass to the handler |
| `options.validate` | `boolean` | No | Enable runtime validation. **Default: `false`** |

**Returns:** `Promise<TOutput>` — the handler's result, optionally validated by schema.

**Throws:**
- `Error` if the variant name is not defined
- `ZodError` if Zod validation fails (validate: true)
- `Error` if TypeBox validation fails (validate: true)
- `ValidationError` if Ajv/JSON Schema validation fails (validate: true)
