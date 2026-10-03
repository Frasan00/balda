---
title: Error Handling
description: Intelligent error handling following HTTP specs. Custom error classes, global error handlers, and security best practices.
keywords: [balda, error handling, exception, http errors, status codes]
sidebar_position: 9
---

# Error Handling

Balda provides intelligent error handling out of the box, following HTTP specifications (RFC 7231) for proper status codes and security best practices for error responses.

## Error Response Format

Built-in errors (404, 405, body parser, static files, runtime fallbacks) are serialized through a
single factory that emits two fields:

```typescript
{
  "code": "RouteNotFoundError",     // the error class name
  "message": "ROUTE_NOT_FOUND: Cannot GET /unknown"
}
```

`code` is the error class name (`RouteNotFoundError`, `MethodNotAllowedError`,
`JsonNotValidError`, `FileTooLargeError`, …) and falls back to `"INTERNAL_ERROR"` when a class does
not set a name.

### Stack Traces Are Off by Default

`stack` and `cause` are **not** included unless you opt in:

```typescript
const server = new Server({
  exposeErrorDetails: true, // include stack + cause in built-in error bodies
});
```

| Value    | Behaviour                                                              |
| -------- | ---------------------------------------------------------------------- |
| `false`  | Default. Never include `stack`/`cause`.                                |
| `true`   | Always include them — only do this on internal or local servers.       |
| `"auto"` | Legacy behaviour: include them only when `NODE_ENV === "development"`. |

The default used to follow `NODE_ENV`, which meant an internet-reachable container with
`NODE_ENV=development` leaked absolute source paths, middleware chains, and the exact framework
version to unauthenticated clients. Exposure is now opt-in and independent of the environment.

:::warning Process-wide setting
The built-in error factory is module-global, so when several `Server` instances coexist the value
from the most recently constructed one applies to all of them. Custom `setErrorHandler` /
`setNotFoundHandler` callbacks are unaffected — they always receive the raw error.
:::

### Keep the Details in Your Handler, Not the Response

A custom handler receives the raw error, so you can log the full stack while returning a sanitized
body:

```typescript
server.setErrorHandler((req, res, next, error) => {
  logger.error({ err: error, url: req.url }, "Unhandled error"); // full stack, server-side
  res.internalServerError({ code: "INTERNAL_ERROR" }); // clean, client-side
});
```

## 404 Not Found

When a request is made to a path that doesn't exist for **any** HTTP method, Balda returns a `404 Not Found` response.

```typescript
// No routes defined for /unknown
// Request: GET /unknown
// Response: 404 Not Found

{
  "code": "RouteNotFoundError",
  "message": "ROUTE_NOT_FOUND: Cannot GET /unknown"
}
```

### Custom Not Found Handler

You can customize the 404 response using `setNotFoundHandler`. The handler receives the
`RouteNotFoundError` that triggered the response as an optional third argument, so you can inspect
it (or forward it to your logger) while returning your own body:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.setNotFoundHandler((req, res, error) => {
  logger.warn({ err: error, path: new URL(req.url).pathname }, "404");

  res.status(404).json({
    error: "Page not found",
    path: new URL(req.url).pathname,
    suggestion: "Check the API documentation at /docs",
  });
});

server.listen();
```

A custom not-found handler also answers 405 requests — the error passed in is a
`MethodNotAllowedError` in that case, which you can branch on:

```typescript
server.setNotFoundHandler((req, res, error) => {
  if (error.name === "MethodNotAllowedError") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.status(404).json({ error: "Page not found" });
});
```

:::note
When no custom handler is registered, Balda sets the `Allow` header itself before returning the 405. If you register one, the header is yours to set.
:::

## 405 Method Not Allowed

When a request is made to a path that **exists** but with a different HTTP method, Balda returns a `405 Method Not Allowed` response with an `Allow` header listing the valid methods.

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

// Only POST is allowed for /users
router.post("/users", (req, res) => {
  res.created({ id: 1, ...req.body });
});

server.listen();
```

```bash
# Request: GET /users
# Response: 405 Method Not Allowed
# Headers: Allow: POST

{
  "code": "MethodNotAllowedError",
  "message": "METHOD_NOT_ALLOWED: Cannot GET /users"
}
```

### Multiple Allowed Methods

If a path is registered with multiple methods, all valid methods are listed in the `Allow` header:

```typescript
router.get("/users", (req, res) => {
  res.json({ users: [] });
});

router.post("/users", (req, res) => {
  res.created(req.body); // Automatically parsed when using body parser middleware
});

// Request: DELETE /users
// Response: 405 Method Not Allowed
// Headers: Allow: GET, POST
```

## Route Matching Priority

Balda uses a radix trie router with the following matching priority:

| Priority | Type          | Example      | Description                 |
| -------- | ------------- | ------------ | --------------------------- |
| 1st      | Static        | `/users`     | Exact path match            |
| 2nd      | Parameterized | `/users/:id` | Dynamic segments            |
| 3rd      | Wildcard      | `*`          | Catch-all (404/405 handler) |

This ensures that specific routes always take precedence over catch-all handlers.

```typescript
router.get("/users", handler); // Matches GET /users
router.get("/users/:id", handler); // Matches GET /users/123
// Wildcard catch-all handles everything else (404/405)
```

## Global Error Handler

For handling errors thrown during request processing, use `setErrorHandler`. It receives the raw
thrown error — stack and cause included — regardless of `exposeErrorDetails`, because it is your
handler's job to decide what reaches the client:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.setErrorHandler((req, res, next, error) => {
  logger.error({ err: error, url: req.url }, "Request error"); // full detail, server-side

  // Handle specific error types
  if (error.name === "ValidationError") {
    return res.badRequest({
      code: "VALIDATION_ERROR",
      message: error.message,
    });
  }

  if (error.name === "UnauthorizedError") {
    return res.unauthorized({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Default error response
  res.internalServerError({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
});

server.listen();
```

## Validation Error Handler

When request validation fails (body, query, or all schemas), Balda responds with `400 Bad Request` by default. You can customize this globally with `setValidationErrorHandler`:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.setValidationErrorHandler((req, res, error) => {
  // error contains the AJV validation error details
  res.status(422).json({
    code: "VALIDATION_FAILED",
    message: "Request validation failed",
    details: error,
    path: new URL(req.url).pathname,
  });
});

server.listen();
```

This handler applies to all validation failures from both:

- **Inline route validation** (`body`, `query`, `all` options in route definitions)
- **@validate decorator** validation in controllers

:::tip
If you only need to customize validation errors for a specific controller route, you can use the `customError` option in the `@validate` decorator instead.
:::

## Policy Error Handler

When a policy check fails, Balda responds with `401 Unauthorized` and `{ error: "Unauthorized" }` by default. You can customize this globally with `setPolicyErrorHandler`:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.setPolicyErrorHandler((req, res) => {
  res.status(403).json({
    code: "FORBIDDEN",
    message: "You do not have permission to access this resource",
    path: new URL(req.url).pathname,
  });
});

server.listen();
```

This handler applies to all policy failures from both:

- **Inline route policies** (`policy` option in route definitions)
- **@policy decorator** policies on controllers

## Built-in Error Types

Balda provides several built-in error types. Each one becomes the `code` of the response body:

| Error                   | `code`                  | Status | Description                              |
| ----------------------- | ----------------------- | ------ | ---------------------------------------- |
| `RouteNotFoundError`    | `RouteNotFoundError`    | 404    | Path doesn't exist for any method        |
| `MethodNotAllowedError` | `MethodNotAllowedError` | 405    | Path exists but not for requested method |
| `JsonNotValidError`     | `JsonNotValidError`     | 400    | Invalid JSON in request body             |
| `FileTooLargeError`     | `FileTooLargeError`     | 413    | Uploaded file exceeds size limit         |
| `FileNotFoundError`     | `FileNotFoundError`     | 404    | Requested file is missing from storage   |

These classes are framework-internal — they are not exported from `balda`, and they are not a
generic "throw to set an HTTP status" API. Use the `res.<status>()` helpers for client errors you
produce yourself.

## Best Practices

### 1. Leave `exposeErrorDetails` Off

```typescript
const server = new Server({
  exposeErrorDetails: false, // the default — be explicit if you like
});
```

Stack traces expose internal file paths, function names, and framework internals. Only turn
exposure on for a server that is not reachable from the public internet, and prefer `setErrorHandler`
logging over sending detail to clients.

### 2. Use Specific Error Handlers

```typescript
server.setErrorHandler((req, res, next, error) => {
  // Log the full error internally
  console.error({
    error: error.message,
    stack: error.stack,
    path: req.url,
    method: req.method,
  });

  // Return safe response to client
  res.internalServerError({
    code: "INTERNAL_ERROR",
    message: "Something went wrong",
  });
});
```

### 3. Provide Helpful 404 Responses

```typescript
server.setNotFoundHandler((req, res, error) => {
  const pathname = new URL(req.url).pathname;

  res.status(404).json({
    code: "NOT_FOUND",
    message: `The endpoint ${pathname} does not exist`,
    docs: "/api/docs",
  });
});
```

### 4. Log Errors for Debugging

```typescript
server.setErrorHandler((req, res, next, error) => {
  // Use your logging service
  logger.error({
    requestId: req.id,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.internalServerError({
    code: "INTERNAL_ERROR",
    requestId: req.id, // Include for support reference
  });
});
```

## HTTP Status Code Reference

| Status                      | Method | Description               |
| --------------------------- | ------ | ------------------------- |
| `res.badRequest()`          | 400    | Invalid request syntax    |
| `res.unauthorized()`        | 401    | Authentication required   |
| `res.forbidden()`           | 403    | Access denied             |
| `res.notFound()`            | 404    | Resource not found        |
| `res.methodNotAllowed()`    | 405    | HTTP method not supported |
| `res.conflict()`            | 409    | Resource conflict         |
| `res.internalServerError()` | 500    | Server error              |
