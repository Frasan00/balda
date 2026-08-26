# Serializer `ctx` Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate an optional `ctx` parameter into `SerializerBuilder` and `VariantHandler` to allow context-aware variant processing.

**Architecture:** Update interfaces and implementations to support `ctx?: TCtx` (default `unknown`) throughout the variant lifecycle.

**Tech Stack:** TypeScript, Node.js

---

### Task 1: Update Type Definitions

**Files:**
- Modify: `src/serializer/serializer_types.ts`

- [ ] **Step 1: Update `VariantHandler` type**

```typescript
export type VariantHandler<TInput, TOutput, TCtx = unknown> = (
  input: TInput,
  ctx?: TCtx,
) => TOutput | Promise<TOutput>;
```

- [ ] **Step 2: Update `VariantConfig` interface**

```typescript
export interface VariantConfig<TInput = unknown, TCtx = unknown> {
  handler: VariantHandler<TInput, unknown, TCtx>;
  schema?: RequestSchema;
  validate: boolean;
}
```

- [ ] **Step 3: Update `SerializerBuilder` interface**

```typescript
export interface SerializerBuilder<
  TInput,
  TDeclaredVariants extends string,
  TVariantMap extends Record<string, unknown>,
  TCtx = unknown,
> {
  defineVariant<const TName extends string, TOutput, TSchema extends RequestSchema>(
    name: TName,
    schema: TSchema,
    handler: (input: TInput, ctx?: TCtx) => ValidatedData<TSchema> | Promise<ValidatedData<TSchema>>,
    options?: { validate?: boolean },
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, ValidatedData<TSchema>>,
    TCtx
  >;

  defineVariant<const TName extends string, TOutput>(
    name: TName,
    handler: (input: TInput, ctx?: TCtx) => TOutput | Promise<TOutput>,
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, TOutput>,
    TCtx
  >;

  useVariant<TName extends TDeclaredVariants>(
    name: TName,
    data: TInput,
    ctx?: TCtx,
  ): Promise<TVariantMap[TName]>;
}
```

### Task 2: Update Implementation

**Files:**
- Modify: `src/serializer/serializer.ts`

- [ ] **Step 1: Update `SerializerBuilderImpl` and `defineVariant`**

Update `SerializerBuilderImpl` signature and `defineVariant` implementation to correctly type and store the handler with `ctx`.

```typescript
class SerializerBuilderImpl<
    TInput,
    TDeclaredVariants extends string,
    TVariantMap extends Record<string, unknown>,
    TCtx = unknown,
  >
  implements SerializerBuilder<TInput, TDeclaredVariants, TVariantMap, TCtx>
{
  constructor(
    private readonly variants: Map<string, VariantConfig<TInput, TCtx>> = new Map(),
  ) {}

  defineVariant<const TName extends string, TOutput, TSchema extends RequestSchema>(
    name: TName,
    schema: TSchema,
    handler: (input: TInput, ctx?: TCtx) => TOutput | Promise<TOutput>,
    options?: { validate?: boolean },
  ): SerializerBuilder<...> {
      // ... existing logic updated to use new types ...
  }
}
```

- [ ] **Step 2: Update `useVariant`**

```typescript
  async useVariant<TName extends TDeclaredVariants>(
    name: TName,
    data: TInput,
    ctx?: TCtx,
  ): Promise<TVariantMap[TName]> {
    // ...
    const result = await config.handler(data, ctx);
    // ...
  }
```

- [ ] **Step 3: Update `serializer` factory**

```typescript
export function serializer<TSchema extends RequestSchema, TCtx = unknown>(
  inputSchema: TSchema,
): SerializerBuilder<ValidatedData<TSchema>, never, {}, TCtx>;
// ...
```

### Task 3: Verify with Tests

**Files:**
- Create: `test/serializer/serializer_ctx.test.ts`

- [ ] **Step 1: Write test case**

```typescript
import { expect, test } from "vitest";
import { serializer } from "../../src/serializer/serializer";

test("should pass ctx to variant handler", async () => {
  const s = serializer<string, { userId: string }>();
  s.defineVariant("test", (input, ctx) => `${input}-${ctx?.userId}`);

  const result = await s.useVariant("test", "hello", { userId: "123" });
  expect(result).toBe("hello-123");
});
```

- [ ] **Step 2: Run tests**

Run: `npm test test/serializer/serializer_ctx.test.ts`
Expected: PASS
