---
title: Routing
description: Define routes with the router singleton, controller decorators, or direct server registration. Support for params, query, and validation.
keywords: [balda, routing, routes, endpoints, paths, url parameters]
sidebar_position: 3
---

# Routing

Balda provides flexible routing through direct server registration, the router singleton, or controller decorators.

## Route Registration Methods

### 1. Direct Server Routes

```typescript
import { Server, router } from "balda";
import { z } from "zod";

const server = new Server({ port: 3000 });

// Simple routes
router.get("/users", (req, res) => res.json({ users: [] }));
router.post("/users", (req, res) => res.created(req.body));
router.put("/users/:id", (req, res) => res.json({ id: req.params.id }));
router.delete("/users/:id", (req, res) => res.noContent());

// With inline validation - validated data is written to req.body / req.query
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.post(
  "/users/validated",
  {
    body: CreateUserSchema,
  },
  (req, res) => {
    // req.body is validated and typed
    res.created({ id: "123", ...req.body });
  },
);

// With options
router.post(
  "/users",
  {
    middlewares: [authMiddleware],
    body: CreateUserSchema,
    responses: {
      201: UserResponseSchema,
    },
    swagger: {
      name: "Create User",
    },
  },
  (req, res) => {
    res.created(req.body);
  },
);
```

### 2. Router Singleton

Useful for modular route definitions:

```typescript
import { router } from "balda";
import { z } from "zod";

// Simple routes
router.get("/health", (req, res) => res.json({ status: "ok" }));

// With inline validation
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/login",
  {
    body: LoginSchema,
  },
  (req, res) => {
    // req.body is validated and typed
    const { email, password } = req.body;
    res.json({ token: generateToken(email, password) });
  },
);

// Query validation
const SearchSchema = z.object({
  q: z.string(),
  page: z.coerce.number().default(1),
});

router.get(
  "/search",
  {
    query: SearchSchema,
  },
  (req, res) => {
    // query parameters are validated and type-coerced
    res.json({ results: [], query: req.query.q, page: req.query.page });
  },
);
```

### Catch-all methods: `router.any()`

`router.any()` registers a route that matches **every HTTP method** — including methods
not explicitly mapped by the framework (e.g. the new `QUERY` method, RFC 9520). It works
even when no dedicated `router.query()` exists.

A specific method route (e.g. `router.post()`) always takes precedence over an `any()`
route for that method.

```typescript
// Matches GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, QUERY, and any future method
router.any("/webhook", (req, res) => {
  res.json({ method: req.method });
});

// Root catch-all (e.g. SPA fallback) — takes precedence over the built-in 404 handler
router.any("*", (req, res) => {
  res.sendFile("index.html");
});
```

:::note Swagger
OpenAPI 3.x has no "any method" concept, so `any()` routes are emitted under a
non-standard `any` key that Swagger UI/validators may ignore.
:::

### The `QUERY` method: `router.query()`

The `QUERY` method (RFC 9520) is used to retrieve a representation selected by a query
expression. It can carry a request body, so `body` and `all` validation are supported.

```typescript
router.query(
  "/search",
  {
    body: SearchExpressionSchema,
  },
  (req, res) => {
    // req.body is the validated query expression
    res.json({ results: runQuery(req.body) });
  },
);
```

:::note Swagger
OpenAPI 3.x does not standardize the `QUERY` method, so `query()` routes are emitted
under a non-standard `query` key that Swagger UI/validators may ignore.
:::

### 3. Controller Decorators

For organized, feature-based routing:

```typescript
import { controller, get, post } from "balda";

@controller("/users")
export class UsersController {
  @get("/") getAll(req, res) {
    res.json({ users: [] });
  }
  @get("/:id") getById(req, res) {
    res.json({ id: req.params.id });
  }
  @post("/") create(req, res) {
    res.created(req.body);
  }
}
```

See [Controllers](./controllers) for detailed controller documentation.

### Type Safety Comparison

Imperative route definitions (direct server routes and router singleton) are the **gold standard** for type safety in Balda. They provide full inline type inference that controllers cannot match:

| Feature                       |            Imperative Routes            |         Controller Decorators          |
| ----------------------------- | :-------------------------------------: | :------------------------------------: |
| Path parameter inference      |              ✅ Automatic               |  ❌ Manual `Request<{ id: string }>`   |
| Body/query schema inference   | ✅ Automatic via `body`/`query` options |  ❌ Injected as extra handler params   |
| Response type inference       |   ✅ Automatic via `responses` option   |    ❌ Manual `Response<{ 200: T }>`    |
| **TypedMiddleware inference** |     ✅ Automatic from `middlewares`     | ❌ Not possible (decorator limitation) |

```typescript
import { defineMiddleware, router } from "balda";
import { z } from "zod";

const auth = defineMiddleware<{ userId: number }>(async (req, res, next) => {
  req.userId = 123;
  return next();
});

const UserSchema = z.object({ id: z.string(), name: z.string() });

// ✅ Imperative route — everything is inferred
router.get(
  "/users/:id",
  {
    middlewares: [auth],
    responses: { 200: UserSchema },
  },
  (req, res) => {
    req.params.id; // ✅ string (path inference)
    req.userId; // ✅ number (middleware inference)
    res.ok({ id: "1", name: "Alice" }); // ✅ typed (response inference)
  },
);
```

:::tip Recommendation
Use **imperative route definitions** for the best developer experience. They provide zero-config type inference for path params, request body/query, response schemas, and typed middleware — all in a single, composable function call.

Controllers are still useful for organizing large codebases into feature modules, but require manual type annotations for the same level of type safety.
:::

## Route Parameters

### Path Parameters

```typescript
// Single parameter
router.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

// Multiple parameters
router.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});
```

### Query Parameters

```typescript
router.get("/users", (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  res.json({ page: Number(page), limit: Number(limit), search });
});
```

## Route Patterns

```typescript
// Static route
router.get("/about", (req, res) => res.json({ message: "About" }));

// Dynamic parameter
router.get("/users/:id", (req, res) => res.json({ id: req.params.id }));

// Optional parameter
router.get("/posts/:id?", (req, res) => {
  req.params.id ? res.json({ id }) : res.json({ posts: [] });
});

// Wildcard
router.get("/files/*", (req, res) => {
  res.json({ filePath: req.params["*"] });
});
```

## Route Precedence

Routes are matched in registration order. Define specific routes before general ones:

```typescript
// Specific first
router.get("/users/admin", (req, res) => res.json({ admin: true }));
// General after
router.get("/users/:id", (req, res) => res.json({ id: req.params.id }));
```

## Type-Safe Routing

Balda provides automatic type inference for both path parameters and response bodies.

### Path Parameters

Path parameters are automatically inferred from the route path string:

```typescript
// Path parameters are inferred — no manual typing needed
router.get("/users/:id", (req, res) => {
  const { id } = req.params; // ✅ Typed as { id: string }
  res.json({ id });
});
```

### Type-Safe Responses

When you define response schemas in the `responses` option, Balda **automatically infers** the response body types for each status code. This works with Zod, TypeBox, and plain JSON schemas:

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

router.get(
  "/users/:id",
  {
    responses: {
      200: UserSchema,
      404: ErrorSchema,
    },
  },
  (req, res) => {
    const { id } = req.params; // ✅ Typed as { id: string }

    res.ok({ id, name: "John", email: "john@example.com" }); // ✅ Typed as { id: string; name: string; email: string }
    res.notFound({ error: "User not found" }); // ✅ Typed as { error: string }

    // res.ok({ wrong: 123 });           // ❌ Type error — doesn't match UserSchema
    // res.notFound({ wrong: "value" }); // ❌ Type error — doesn't match ErrorSchema
  },
);
```

Each shorthand method (`ok()`, `created()`, `notFound()`, etc.) is typed to its corresponding status code schema. Methods for unmapped status codes default to `any`.

:::tip TypeBox and plain JSON schemas
TypeBox schemas provide the same type inference as Zod via `Static<T>`. Plain JSON Schema objects also support full type inference via [`json-schema-to-ts`](https://github.com/ThomasAribart/json-schema-to-ts) — **`as const` is required** so TypeScript preserves the literal types needed for inference.

Also, you need to install `json-schema-to-ts` to be able to use plain JSON schemas with type inference.

```bash
npm install json-schema-to-ts --save-dev
```

```typescript
const UserSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
  },
  required: ["id", "name"],
  additionalProperties: false,
} as const; // ← required for type inference

router.get("/users/:id", { responses: { 200: UserSchema } }, (req, res) => {
  res.ok({ id: 1, name: "Alice" }); // ✅ typed as { id: number; name: string }
});
```

Without `as const`, plain JSON schema objects resolve to `any`.
:::

### Controller Type Safety

For controller-based routes, you can manually type the `Response` generic:

```typescript
import { Request, Response } from 'balda';

type UserResponse = { id: string; name: string; email: string };

@post('/')
@validate.body(CreateUserSchema)
async create(
  req: Request<{}>,
  res: Response<{ 201: UserResponse }>,
  body: z.infer<typeof CreateUserSchema> // ✅ Validated & typed
) {
  res.created({ id: '123', ...body }); // ✅ Typed as UserResponse
}
```

See [Request-Response](./request-response) for more on type-safe requests and responses.

## Route Options

All route methods (`get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `any`, `query`) support an optional configuration object:

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const QuerySchema = z.object({
  includeDeleted: z.coerce.boolean().default(false),
});

router.post(
  "/users",
  {
    // Request validation — inline route validation writes validated data to `req`
    body: UserSchema, // Validates and sets `req.body`
    query: QuerySchema, // Validates and sets `req.query`
    all: CombinedSchema, // Validates body+query merged (mutually exclusive with body/query)

    // Middleware
    middlewares: [authMiddleware, validationMiddleware], // or single middleware

    // Policy — enforced before middlewares
    policy: { manager: policyManager, scope: "auth", handler: "isAdmin" },
    // or multiple: policy: [{ manager, scope, handler }, ...]

    // Swagger documentation
    swagger: {
      name: "Create User",
      description: "Creates a new user",
      responses: {
        201: UserResponseSchema,
        400: ErrorSchema,
      },
    },
  },
  (req, res) => {
    // req.body and req.query are typed and validated
    res.created({ id: "123", ...req.body });
  },
);
```

### Validation Options

- **`body`**: Validates the request body and writes the typed result to `req.body`.
- **`query`**: Validates the query string and writes the typed result to `req.query`.
- **`all`**: Validates a merged object composed of body + query and writes the result to `req.body` (cannot be used with `body` or `query`).
- **`policy`**: Applies one or more policy checks before the route handler runs. Accepts a single `PolicyRouteConfig` or an array (see [Policies](./policies#inline-route-policy-option)).

:::tip Automatic Swagger Integration
When you specify `body` or `query` at the route level, they're automatically included in Swagger documentation. No need to specify `requestBody` or `query` in the swagger options.
:::

## Route Groups

Use `router.group()` to organize related routes:

```typescript
import { z } from "zod";

// Basic grouping
router.group("/api/v1", (r) => {
  r.get("/users", (req, res) => res.json({ users: [] }));
  r.get("/posts", (req, res) => res.json({ posts: [] }));
});

// With middleware
router.group("/admin", [authMiddleware, adminMiddleware], (r) => {
  r.get("/dashboard", (req, res) => res.json({ ok: true }));
});

// With validation in grouped routes
router.group("/api/v2", (r) => {
  const CreatePostSchema = z.object({
    title: z.string(),
    content: z.string(),
  });

  r.post(
    "/posts",
    {
      body: CreatePostSchema,
      middlewares: [authMiddleware],
    },
    (req, res, validatedBody) => {
      res.created({ id: "123", ...validatedBody });
    },
  );
});
```

See the [Server documentation](./server) for more details on grouping and middleware.
