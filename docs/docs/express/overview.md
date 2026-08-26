---
title: Express Compatibility
description: Integrate Express middleware with Balda. Experimental layer for third-party Express libraries.
keywords: [balda, express, compatibility, middleware, integration]
sidebar_position: 1
---

# Express Compatibility

:::warning Experimental
The Express compatibility layer is **experimental** and may change in future versions. Use it primarily for integrating third-party Express libraries. For new code, prefer using Balda's native APIs.
:::

Balda provides an Express compatibility layer that allows you to integrate Express-based libraries like **AdminJS**, **Passport**, and other Express middleware into your Balda application.

## Installation

Install the Express types for TypeScript support:

```bash
npm install express
npm install -D @types/express
```

## Quick Start

### Mounting an Express Router

Use `mountExpressRouter` to mount an entire Express router at a specific path:

```typescript
import { Server } from "balda";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";

const admin = new AdminJS({ resources: [] });
const adminRouter = AdminJSExpress.buildRouter(admin);

const server = new Server({ port: 3000 });
server.mountExpressRouter("/admin", adminRouter);
server.listen();
```

### Using Express Middleware

Convert Express middleware to Balda middleware with `useExpress`:

```typescript
import { Server } from "balda";
import helmet from "helmet";
import compression from "compression";

const server = new Server({ port: 3000 });

// Mount middleware at root
server.useExpress(helmet());

// Mount middleware at specific path
server.useExpress("/api", compression());

server.listen();
```

## API Reference

### `server.useExpress(middleware)`

Mount Express middleware or router at the root path.

```typescript
server.useExpress(someExpressMiddleware);
server.useExpress(someExpressRouter);
```

### `server.useExpress(path, middleware)`

Mount Express middleware or router at a specific path.

```typescript
server.useExpress("/admin", adminRouter);
server.useExpress("/api", apiMiddleware);
```

Path-scoped middleware only runs for the mounted path and its descendants. For example, `server.useExpress("/api", mw)` applies to `/api` and `/api/users`, but not `/apiish`.

### `server.mountExpressRouter(basePath, router)`

Directly mount an Express router, extracting all routes.

```typescript
server.mountExpressRouter("/admin", adminJsRouter);
```

### `server.expressMiddleware(middleware)`

Convert an Express middleware to a **Balda-compatible middleware** (`ServerRouteMiddleware`) for use with `server.use()`.

**Returns:** `ServerRouteMiddleware` - A Balda-native middleware function

```typescript
const baldaMiddleware = server.expressMiddleware(someExpressMiddleware);
server.use(baldaMiddleware);
```

## Low-Level Functions

These functions are exported for advanced use cases but should typically be accessed via the server instance:

```typescript
import { expressMiddleware, expressHandler } from "balda";

// Convert Express middleware → Balda middleware (ServerRouteMiddleware)
const baldaMw = expressMiddleware(someExpressMiddleware);

// Convert Express handler → Balda handler (ServerRouteHandler)
const baldaHandler = expressHandler(someExpressHandler);
```

:::tip Recommended Approach
Use the server instance methods instead of standalone functions:

```typescript
const server = new Server({ port: 3000 });

// ✅ Preferred: Use server methods
server.mountExpressRouter("/admin", adminRouter);
server.useExpress(someExpressMiddleware);
server.useExpress("/api", someExpressMiddleware);

// For middleware conversion
const baldaMw = server.expressMiddleware(someExpressMiddleware);
```

:::

## Common Use Cases

### AdminJS Integration

```typescript
import { Server } from "balda";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSSequelize from "@adminjs/sequelize";

AdminJS.registerAdapter(AdminJSSequelize);

const admin = new AdminJS({
  resources: [User, Post, Comment],
  rootPath: "/admin",
});

const adminRouter = AdminJSExpress.buildRouter(admin);

const server = new Server({ port: 3000 });
server.mountExpressRouter("/admin", adminRouter);
server.listen();
```

## Limitations

:::warning Important Limitations
The Express compatibility layer has some limitations you should be aware of:
:::

### Not Supported

| Feature                            | Status | Notes                                                  |
| ---------------------------------- | ------ | ------------------------------------------------------ |
| `res.render()`                     | ❌     | Template engines not supported                         |
| `app.engine()`                     | ❌     | View engines not available                             |
| `app.set()` / `app.get()` settings | ❌     | Express app settings not implemented                   |
| `res.sendFile()` streaming         | ⚠️     | Works but no streaming callbacks                       |
| `req.signedCookies`                | ❌     | Use Balda's cookie plugin instead                      |
| Express sub-apps                   | ❌     | Nested `app.use(app)` not supported                    |
| Express error middleware           | ❌     | 4-argument `(err, req, res, next)` handlers are not supported |
| `res.format()`                     | ❌     | Throws, content negotiation is not implemented         |
| Trust proxy inheritance            | ❌     | Use Balda's `trustProxy` plugin                        |

### Partial Support

- **`res.redirect()`** - Works, but always uses 302 unless status explicitly set
- **`res.cookie()`** - Requires Balda's cookie plugin to be enabled
- **`req.cookies` / `req.session`** - Exposed when Balda's cookie/session plugins are enabled; otherwise they are `undefined`
- **Mounted request URLs** - `req.originalUrl` keeps the incoming path, while `req.baseUrl`, `req.path`, and `req.url` are rewritten relative to the mounted path
- **File uploads** - Use Balda's `fileParser` plugin, not multer
- **Sessions** - Use Balda's session plugin, Express session middleware may not work

### Recommended Approach

For best results, use Balda native features when possible and reserve the Express compatibility layer for third-party libraries:

```typescript
// ✅ Good: Use Express compat for third-party libraries
server.mountExpressRouter("/admin", adminJsRouter);

// ✅ Good: Use Balda native for your own routes
server.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

// ❌ Avoid: Don't use Express compat for simple middleware
// server.useExpress(cors()); // Use Balda's cors plugin instead
server.use(cors({ origin: "*" })); // Native Balda
```

## Troubleshooting

### HTML Not Rendering

If HTML appears as raw text, the Content-Type header may not be set. The adapter auto-detects HTML starting with `<!DOCTYPE` or `<html>`, but you can explicitly set it:

```typescript
// In Express handler
res.type("text/html").send(htmlContent);
```

### Middleware Not Executing

Ensure Express routers are mounted **before** calling `server.listen()`:

```typescript
const server = new Server({ port: 3000 });

// ✅ Correct: Mount before listen
server.mountExpressRouter("/admin", adminRouter);
server.listen();

// ❌ Wrong: Mounting after listen won't work correctly
```

### Cookie/Session Issues

Enable Balda's cookie plugin for Express middleware that uses cookies:

```typescript
const server = new Server({
  port: 3000,
  plugins: {
    cookie: {}, // Enable cookie parsing
  },
});
```

## Runtime Support

The Express compatibility layer works across all Balda-supported runtimes:

| Runtime | Support |
| ------- | ------- |
| Node.js | ✅ Full |
| Bun     | ✅ Full |
| Deno    | ✅ Full |

Note: Some Express middleware may have runtime-specific dependencies that only work in Node.js.
