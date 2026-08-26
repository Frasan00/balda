# Design: Serializer `ctx` Integration

This design covers adding an optional `ctx` parameter to variant handlers in the `SerializerBuilder`.

## Overview
The `SerializerBuilder` will be updated to allow variant handlers to receive an optional `ctx` (context) parameter. This allows for passing additional context (e.g., request state, user info) during variant execution.

## Changes

### 1. Type Definitions (`src/serializer/serializer_types.ts`)
- Update `VariantHandler` to: `(input: TInput, ctx?: TCtx) => TOutput | Promise<TOutput>`.
- Update `VariantConfig` to include `ctx` type support.
- Update `SerializerBuilder` methods (`defineVariant`, `useVariant`) to accept `ctx`.

### 2. Implementation (`src/serializer/serializer.ts`)
- Update `SerializerBuilderImpl` to store `ctx` (if needed for type-safety/config).
- Update `defineVariant` implementation to handle the optional `ctx` signature.
- Update `useVariant` to pass the `ctx` argument to the handler.

## Success Criteria
- Existing code continues to compile (using `unknown` as the default for `TCtx`).
- `useVariant` now accepts an optional second argument `ctx`.
- Variant handlers defined with `ctx` can now access it as the second argument.
