---
title: Middleware
description: Create global, controller-level, and route-level middleware. Typed middleware with automatic request extension inference.
keywords: [balda, middleware, request, response, next, authentication]
sidebar_position: 4
---

# Middleware

Middleware in Balda are functions that have access to the request object, response object, and the next middleware function in the application's request-response cycle. They can execute code, modify the request and response objects, end the request-response cycle, and call the next middleware function.

## Basic Middleware

### Function Signature

```typescript
type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;
```

### Simple Middleware Example

```typescript
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
};

const auth = (req, res, next) => {
  const token = req.rawHeaders.get('authorization');

  if (!token) {
    return res.unauthorized({ error: "Authentication required" });
  }

  // Verify token logic here
  req.user = { id: 1, name: "John" };
  next();
};
```

## Middleware Application

### Global Middleware

```typescript
const server = new Server({ port: 3000 });

// Single middleware
server.use(loggerMiddleware);

// Multiple middleware
server.use(authMiddleware, loggingMiddleware);
```

#### Using Middlewares via Server Options

Alternatively, you can pass middlewares directly in the server configuration:

```typescript
import { Server } from "balda";
import { authMiddleware, loggingMiddleware } from "./middlewares";

const server = new Server({
  plugins: [authMiddleware, loggingMiddleware],
});
```

This approach is useful when you want to configure all middleware before server initialization. It's equivalent to calling `server.use()` for each middleware.

### Controller-Level Middleware

```typescript
@controller("/users")
@middleware(authMiddleware)
export class UsersController {
  @get("/") getAll(req, res) {
    /* uses authMiddleware */
  }

  @get("/public")
  @middleware(publicMiddleware) // Override
  getPublic(req, res) {
    /* uses publicMiddleware instead */
  }
}
```

### Route-Level Middleware

```typescript
// Direct registration
server.get('/admin', authMiddleware, (req, res) => res.json({ ok: true }));

// Controller route
@get('/admin', { middleware: [authMiddleware, adminMiddleware] })
getAdmin(req, res) { res.json({ users: [] }); }
```

## Common Middleware Patterns

### Authentication

```typescript
const authMiddleware = async (req, res, next) => {
  const token = req.rawHeaders.get('authorization')?.replace("Bearer ", "");

  if (!token) {
    return res.unauthorized({ error: "Token required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.unauthorized({ error: "Invalid token" });
  }
};
```

### Role-Based Authorization

```typescript
const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.forbidden({ error: 'Insufficient permissions' });
  }
  next();
};

// Usage
@get('/admin', { middleware: [authMiddleware, requireRole('admin')] })
getAdmin(req, res) { res.json({ admin: true }); }
```

### Request Logging

```typescript
const logger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.url} ${res.statusCode} - ${Date.now() - start}ms`,
    );
  });
  next();
};
```

:::tip
For production use, leverage built-in plugins:

- `cors` plugin for CORS handling
- `rateLimiter` plugin for rate limiting
- `log` plugin for request/response logging

See [Plugins Overview](../plugins/overview) for details.
:::

## Middleware Order

Middleware executes in order: Global → Controller → Route → Handler

```typescript
server.use(logger); // 1. Global
server.use(cors); // 2. Global

@controller("/users")
@middleware(authMiddleware) // 3. Controller
export class UsersController {
  @get("/admin", { middleware: [adminMiddleware] }) // 4. Route
  getAdmin(req, res) {
    // 5. Handler
    // Execution: logger → cors → authMiddleware → adminMiddleware → handler
  }
}
```

## Async Middleware

```typescript
const asyncAuth = async (req, res, next) => {
  try {
    const user = await verifyToken(req.rawHeaders.get('authorization'));
    req.user = user;
    next();
  } catch {
    return res.unauthorized({ error: "Invalid token" });
  }
};
```

## Conditional Middleware

```typescript
const conditionalAuth = (req, res, next) => {
  if (req.path.startsWith("/public")) {
    return next(); // Skip auth for public routes
  }

  const token = req.rawHeaders.get('authorization');
  if (!token) {
    return res.unauthorized({ error: "Authentication required" });
  }

  req.user = { id: 1 };
  next();
};
```

## Typed Middleware

When a middleware adds properties to the request (e.g. `req.userId`, `req.session`), you can use **`TypedMiddleware`** so those properties are automatically inferred in your route handlers — no `declare module` augmentation or manual casting needed.

### Defining a Typed Middleware

Use `defineMiddleware<T>()` where `T` describes the properties added to the request:

```typescript
import { defineMiddleware } from "balda";
import type { TypedMiddleware } from "balda";

type AuthExtension = { userId: number; role: string };

export const auth: TypedMiddleware<AuthExtension> =
  defineMiddleware<AuthExtension>(async (req, res, next) => {
    const token = req.rawHeaders.get("authorization")?.replace("Bearer ", "");
    if (!token) return res.unauthorized({ error: "Token required" });

    const payload = verifyToken(token);
    req.userId = payload.userId; // ✅ typed inside the middleware body
    req.role = payload.role;
    return next();
  });
```

### Using Typed Middleware in Routes

When you pass a `TypedMiddleware` in the `middlewares` option of an imperative route, the handler's `req` parameter is automatically extended:

```typescript
import { router } from "balda";
import { auth } from "./middlewares/auth";

router.get("/profile", { middlewares: [auth] }, (req, res) => {
  req.userId; // ✅ number — inferred from AuthExtension
  req.role; // ✅ string — inferred from AuthExtension
  res.json({ userId: req.userId, role: req.role });
});
```

Multiple typed middlewares compose automatically:

```typescript
const tenantMiddleware = defineMiddleware<{ tenantId: string }>(
  async (req, res, next) => {
    req.tenantId = req.rawHeaders.get("x-tenant-id") ?? "default";
    return next();
  },
);

router.get(
  "/dashboard",
  { middlewares: [auth, tenantMiddleware] },
  (req, res) => {
    req.userId; // ✅ number
    req.tenantId; // ✅ string
    res.json({ userId: req.userId, tenant: req.tenantId });
  },
);
```

### Built-in Typed Middlewares

Balda's built-in plugins that augment the request already return `TypedMiddleware`:

| Plugin      | Properties added                           | Type                                             |
| ----------- | ------------------------------------------ | ------------------------------------------------ |
| `cookie()`  | `cookies`                                  | `Record<string, string>`                         |
| `session()` | `session`, `saveSession`, `destroySession` | `Record<string, any>`, `() => Promise<void>` × 2 |
| `timeout()` | `timeout`                                  | `boolean`                                        |

This means you get automatic type inference when using them in imperative routes:

```typescript
import { router, cookie, session } from "balda";

router.post("/login", { middlewares: [cookie(), session()] }, (req, res) => {
  req.cookies; // ✅ Record<string, string>
  req.session; // ✅ Record<string, any>
  res.json({ ok: true });
});
```

### When It Works

Type inference for `TypedMiddleware` works with **imperative route definitions** (using the router singleton):

```typescript
// ✅ Inline inference works
router.get("/users", { middlewares: [auth] }, (req, res) => {
  req.userId; // number
});

// ✅ Route groups work too
router.group("/api", [auth], (r) => {
  r.get("/me", (req, res) => {
    // Note: group-level middleware types are not inferred into nested handlers
    // Use route-level middlewares for full type inference
  });
});
```

:::caution Controller Limitations
Class-based controllers using `@middleware()` decorators do **not** infer `TypedMiddleware` extensions — TypeScript decorators cannot modify method parameter types. For controllers, use manual type annotations or `declare module` augmentation instead.

For the best type safety, use **imperative route definitions** — see [Routing](./routing#type-safety-comparison).
:::
