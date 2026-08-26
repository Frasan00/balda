---
title: generate-middleware
description: Generate typed middleware for request processing with automatic type inference in route handlers.
keywords: [balda, generate middleware, middleware, typed, request]
sidebar_position: 11
---

# generate-middleware

Generate a new middleware function.

```bash
npx balda generate-middleware auth -p src/middlewares
```

**Generated file:** `src/middlewares/auth.ts`

## Flags

- `-p, --path <string>`: Target directory (default `src/middlewares`)

## Generated Code

```ts
import { defineMiddleware } from "balda";
import type { TypedMiddleware } from "balda";

// Define the properties this middleware adds to the request
type AuthExtension = {
  // example: userId: number;
};

export const Auth: TypedMiddleware<AuthExtension> =
  defineMiddleware<AuthExtension>(async (req, res, next) => {
    // Add your middleware logic here
    return next();
  });
```

The scaffold uses `TypedMiddleware` and `defineMiddleware` so that any properties your middleware adds to the request are automatically inferred in route handlers. See [Typed Middleware](../../core-concepts/middleware#typed-middleware) for details.

## Usage

```ts
import { router } from "balda";
import { Auth } from "./middlewares/auth";

// Imperative route — middleware extensions are inferred inline
router.get("/protected", { middlewares: [Auth] }, (req, res) => {
  // req now has the properties defined in AuthExtension
  res.json({ ok: true });
});
```
