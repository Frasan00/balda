---
title: Request & Response
description: Handle HTTP requests and responses with Balda's intuitive API. Web API compatibility, streaming, and helper methods.
keywords: [balda, request, response, http, headers, body, cookies]
sidebar_position: 5
---

# Request & Response

Balda provides a clean and intuitive API for handling HTTP requests and responses. The framework provides custom Request and Response classes with built-in compatibility layers for seamless interoperability with Web API Request/Response objects through `fromRequest()`, `toWebApi()`, and `toWebResponse()` methods.

## Request Object

The request object contains information about the incoming HTTP request.

### Basic Properties

```typescript
interface Request {
  method: string;       // HTTP method (GET, POST, etc.)
  url: string;          // Request URL
  path: string;         // Request path
  rawHeaders: Headers;  // Web API Headers object — use .get(), .has(), .entries()
  headers: Record<string, string | string[]>; // Typed headers — populated only after header schema validation
  query: Record<string, string>; // Query parameters
  params: Record<string, string>; // Route parameters
  body: any;            // Parsed request body from body parser middleware
  ip: string;           // Client IP address
  cookies: Record<string, string>; // Request cookies
}
```

:::tip Headers API
- **`req.rawHeaders`** is the [Web API `Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object. Use it to read any incoming header with `.get('header-name')`. This is available on every request.
- **`req.headers`** is a typed `Record` populated only after validating headers against a schema (see [Validation Options](./routing#validation-options)). Use it to access strongly-typed validated header values.
:::

:::info Web API Compatibility
Balda's Request class provides compatibility with Web API Request objects through:

- **`Request.fromRequest(webRequest)`**: Converts a Web API Request to a Balda Request
- **`req.toWebApi()`**: Converts a Balda Request back to a Web API Request
- **`req.body`**: Contains the parsed request body set by body parser middleware (JSON, URL-encoded, or file uploads). **Use this in your route handlers**.
  :::

### Accessing Request Data

```typescript
@get('/users/:id')
async getUser(req: Request, res: Response) {
  // Route parameters
  const userId = req.params.id;

  // Query parameters
  const { page = 1, limit = 10 } = req.query;

  // Headers — use rawHeaders to read raw incoming headers
  const userAgent = req.rawHeaders.get('user-agent');
  const authToken = req.rawHeaders.get('authorization');

  // Parsed request body (for POST/PUT/PATCH, automatically set by body parser middleware)
  const userData = req.body;  // Available when using body parser middleware (json, urlencoded, or file)

  // Client IP
  const clientIP = req.ip;

  // standard response handling
  res.json({ userId, page, limit, userAgent, clientIP });

  // shortcut for simple objects
  return { userId, page, limit, userAgent, clientIP }
}
```

### Type-Safe Request-Response

Balda provides automatic type inference for both request parameters and response bodies:

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

// Path parameters are inferred from the route path
// Response bodies are inferred from responses schemas
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

    // res.ok({ wrong: 123 });  // ❌ Type error
  },
);

// With validation — inline validation assigns typed data to `req.body`
const CreateUserSchema = z.object({ name: z.string(), email: z.string() });

router.post("/users", { body: CreateUserSchema }, (req, res) => {
  // req.body is typed as z.infer<typeof CreateUserSchema>
  res.created({ id: "123", ...req.body });
});
```

For controller-based routes, use the `@validate` decorator and manually type the `Response` generic:

```typescript
@post('/:userId/posts')
@validate.body(CreatePostSchema)
@validate.query(PostQuerySchema)
async createPost(
  req: Request<{ userId: string }>,
  res: Response<{ 201: PostResponse }>,
  body: z.infer<typeof CreatePostSchema>,
  query: z.infer<typeof PostQuerySchema>
) {
  const { userId } = req.params;
  const { title, content } = body;
  const { draft = false } = query;
  res.created({ id: 'post-123', userId, title, content, draft }); // ✅ Typed as PostResponse
}
```

**Note**: `req.body` and `req.query` are untyped until validated. Inline route validation (via route options `body`/`query`/`all`) writes typed data to `req.body`/`req.query`, while the `@validate` decorators used on controller methods still inject validated arguments into the method signature.

### File Uploads

Handle file uploads with `bodyType: 'form-data'`:

```typescript
import { controller, post } from "balda";
import { z } from "zod";

@controller("/upload")
export class UploadController {
  @post("/", { bodyType: "form-data" })
  async upload(req, res) {
    const file = req.file("fieldName"); // Get file by field name

    if (!file) {
      return res.badRequest({ error: "No file uploaded" });
    }

    res.ok({
      originalName: file.originalName, // Original filename
      formName: file.formName, // Form field name
      size: file.size, // File size in bytes
      mimeType: file.mimeType, // MIME type
      content: file.content, // File content as Uint8Array
    });

    // Other form fields available in req.body
    const { description } = req.body;
  }
}
```

Configure file upload limits:

```typescript
const server = new Server({
  plugins: {
    bodyParser: {
      fileParser: {
        maxFiles: 10,
        maxFileSize: "10mb",
      },
    },
  },
});
```

## Response Object

The response object provides methods for sending HTTP responses.

### Status Methods

```typescript
import { Request, Response } from 'balda';

@get('/users')
async getUsers(req: Request, res: Response) {
  // Success responses
  res.ok({ users: [] });                    // 200 OK
  res.created({ id: 1 });                   // 201 Created
  res.accepted({ jobId: 123 });             // 202 Accepted
  res.noContent();                          // 204 No Content

  // Client error responses
  res.badRequest({ error: 'Invalid data' }); // 400 Bad Request
  res.unauthorized({ error: 'Auth required' }); // 401 Unauthorized
  res.forbidden({ error: 'Access denied' });    // 403 Forbidden
  res.notFound({ error: 'User not found' });    // 404 Not Found
  res.conflict({ error: 'User exists' });       // 409 Conflict
  res.tooManyRequests({ error: 'Rate limited' }); // 429 Too Many Requests

  // Server error responses
  res.internalServerError({ error: 'Server error' }); // 500 Internal Server Error
  res.notImplemented({ error: 'Not implemented' });   // 501 Not Implemented
  res.badGateway({ error: 'Bad gateway' });           // 502 Bad Gateway
  res.serviceUnavailable({ error: 'Unavailable' });   // 503 Service Unavailable
}
```

### Content Methods

```typescript
import { Request, Response } from 'balda';

@get('/api/data')
async getData(req: Request, res: Response) {
  // Manually set headers
  res.setHeader('X-Custom-Header', 'value');

  // JSON response
  res.json({ message: 'Hello World' });

  // Text response
  res.text('Hello World');

  // HTML response
  res.html('<h1>Hello World</h1>');

  // Redirect
  res.redirect('/new-location');

  // Download file
  res.download('/path/to/file.pdf', 'filename.pdf');

  // Send tries to understand the best content type to send based on the body (better to use specific methods)
  res.send({ message: 'Hello World' });
}
```

### Header Management

```typescript
import { Request, Response } from 'balda';

@get('/api/data')
async getData(req: Request, res: Response) {
  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  // Set multiple headers
  res.setHeaders({
    'Content-Type': 'application/json',
    'X-Custom-Header': 'value'
  });

  // Get headers
  const contentType = res.getHeader('Content-Type');

  res.json({ data: 'value' });
}
```

### Cookie Management

```typescript
import { Request, Response } from 'balda';

@post('/login')
async login(req: Request, res: Response) {
  // Set cookies
  res.setCookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Clear cookies
  res.clearCookie('oldSession');

  res.json({ message: 'Logged in' });
}
```

### Middleware-Required Properties

Some request properties are only available when their corresponding middleware is registered. If you access them without the middleware, they throw an error to catch misconfiguration early:

| Property               | Required middleware | Error message                                                                                           |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `req.cookies`          | `cookie()`          | `"Cookie middleware is required to access cookies. Register cookie() before accessing req.cookies."`    |
| `req.cookie(name)`     | `cookie()`          | `"Cookie middleware is required to access cookies. Register cookie() before accessing req.cookies."`    |
| `req.session`          | `session()`         | `"Session middleware is required to access sessions. Register session() before accessing req.session."` |
| `req.saveSession()`    | `session()`         | `"Session middleware is required. Register session() before calling req.saveSession()."`                |
| `req.destroySession()` | `session()`         | `"Session middleware is required. Register session() before calling req.destroySession()."`             |

```typescript
// ❌ Without cookie middleware — throws at runtime
router.get("/no-cookie", (req, res) => {
  req.cookies; // Error: Cookie middleware is required...
});

// ✅ With cookie middleware — works
router.get("/with-cookie", { middlewares: [cookie()] }, (req, res) => {
  req.cookies; // Record<string, string>
});
```

:::tip
This fail-fast behavior helps you catch missing middleware during development instead of silently returning empty values or no-ops.
:::

## Request Validation

Balda supports request validation using Zod, TypeBox, or plain JSON schemas. Validation is powered by AJV for performance, with schemas compiled once and cached for the server's lifetime.

### Two Ways to Validate

#### 1. Decorator-Based Validation (Controllers)

Use `@validate` decorators in controller classes. Validated data is automatically injected as additional handler parameters.

```typescript
import { controller, post, validate } from "balda";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18),
});

@controller("/users")
export class UsersController {
  @post("/")
  @validate.body(CreateUserSchema)
  async createUser(
    req: Request,
    res: Response,
    body: z.infer<typeof CreateUserSchema>,
  ) {
    // body is validated and typed
    const { name, email, age } = body;
    res.created({ name, email, age });
  }
}
```

#### 2. Inline Validation (Direct Routes)

For inline route definitions, use the `body`, `query`, or `all` options. Validated data is written back to the request object (`req.body` and `req.query`), so your handler can remain `(req, res)` and access typed values directly.

```typescript
import { Server } from "balda";
import { z } from "zod";

const server = new Server();

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18),
});

const HeaderSchema = z.object({
  testHeader: z.string().min(1).optional(),
});

const QueryStringSchema = z.object({
  search: z.string().min(1),
});

// Validate request body — validated data is written to `req.body`
server.router.post(
  "/users",
  {
    body: CreateUserSchema,
    headers: HeaderSchema,
    query: QueryStringSchema,
    responses: {
      201: UserResponseSchema,
    },
  },
  (req, res) => {
    // req.body is typed as z.infer<typeof CreateUserSchema>
    const { name, email, age } = req.body;

    // Headers are also validated and typed
    const { testHeader } = req.headers;

    // req.query is also typed
    const { search } = req.query;

    res.created({ name, email, age, testHeader, search });
  },
);

// Validate query parameters — validated data is written to `req.query`
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

router.get(
  "/users",
  {
    query: PaginationSchema,
  },
  (req, res) => {
    const { page, limit } = req.query;
    res.json({ users: [], page, limit });
  },
);

// Validate both body and query — both `req.body` and `req.query` are typed
router.post(
  "/search",
  {
    body: SearchBodySchema,
    query: SearchQuerySchema,
  },
  (req, res) => {
    res.json({ results: [], body: req.body, query: req.query });
  },
);

// Validate all (body + query merged) — merged validated object is written to `req.body`
router.post(
  "/filter",
  {
    all: FilterSchema, // Merges body and query into single validated object
  },
  (req, res) => {
    // req.body contains merged body + query
    res.json({ filtered: req.body });
  },
);
```

**Parameter Order:**

- Inline validation: handler signature is `(req, res)`; validated data is available on `req.body` and/or `req.query`.
- Decorator-based validation (`@validate`): validated data is injected as additional method parameters (legacy behavior).

**By default, validation throws errors on invalid data and returns 422 Unprocessable Entity responses.** Validation happens automatically before your handler executes.

### Built-in Validation Features

Zod is a peer dependency loaded only when Zod schemas are used. Schemas are compiled once and cached during the server lifecycle—no compilation overhead on subsequent requests. Zod4 is required with the `toJSONSchema()` method.

#### Query Parameter Validation

```typescript
import { controller, get, validate } from "balda";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

@controller("/users")
export class UsersController {
  @get("/")
  @validate.query(QuerySchema)
  async getUsers(
    req: Request,
    res: Response,
    query: z.infer<typeof QuerySchema>,
  ) {
    const { page, limit } = query;
    res.json({ users: [], page, limit });
  }
}
```

Or with inline routes:

```typescript
router.get(
  "/users",
  {
    query: QuerySchema,
  },
  (req, res, validatedQuery) => {
    const { page, limit } = validatedQuery;
    res.json({ users: [], page, limit });
  },
);
```

#### Combined Body + Query Validation

```typescript
// Decorator approach
@post('/search')
@validate.body(SearchBodySchema)
@validate.query(SearchQuerySchema)
async search(req: Request, res: Response, body: SearchBody, query: SearchQuery) {
  // Both injected in order
}

// Inline approach
router.post('/search', {
  body: SearchBodySchema,
  query: SearchQuerySchema
}, (req, res, validatedBody, validatedQuery) => {
  // Both injected in order
  res.json({ results: [] });
});

// Or validate all (body + query merged)
router.post('/filter', {
  all: FilterSchema  // Merges body and query
}, (req, res, validatedAll) => {
  res.json({ filtered: validatedAll });
});
```

#### GET and DELETE Validation Restrictions

HTTP specification forbids request bodies for GET and DELETE methods. Balda enforces this at the type level for inline routes:

```typescript
// ❌ TypeScript Error: 'body' is not allowed for GET routes
router.get("/users", { body: UserSchema }, handler);

// ❌ TypeScript Error: 'all' is not allowed for DELETE routes
router.delete("/users", { all: DeleteSchema }, handler);

// ✅ Correct - use query or headers instead
router.get("/users", { query: UserQuerySchema }, handler);
router.delete("/users", { headers: AuthHeadersSchema }, handler);
```

This restriction applies to `body` and `all` validation options. Use `query` or `headers` for GET and DELETE routes. Note that decorator-based validation (`@validate.body()`, `@validate.all()`) is not restricted at compile-time, but the request body will be empty for GET/DELETE requests per HTTP specification.

#### Custom Validation Error Response

By default, validation errors return a 422 response with AJV's error shape:

```json
{
  "message": "validation failed",
  "errors": [
    {
      "instancePath": "/name",
      "schemaPath": "#/required",
      "keyword": "required",
      "params": { "missingProperty": "name" },
      "message": "must have required property 'name'"
    }
  ],
  "ajv": true,
  "validation": true
}
```

Use `setValidationErrorHandler` to customize the status code and response shape:

```typescript
import { z } from "zod";

// Basic - custom status and map
server.setValidationErrorHandler({
  status: 400,
  map: (error, req) => ({
    path: req.path,
    method: req.method,
    message: "Validation failed",
    errors: error.errors,
  }),
});

// With schema for Swagger documentation
server.setValidationErrorHandler({
  status: 422,
  schema: z.object({
    code: z.literal("VALIDATION_ERROR"),
    message: z.string(),
    details: z.array(z.object({
      field: z.string(),
      issue: z.string(),
    })),
  }),
  map: (error, req) => ({
    code: "VALIDATION_ERROR" as const,
    message: "Request validation failed",
    details: error.errors.map(e => ({
      field: e.instancePath || "body",
      issue: e.message || `Failed ${e.keyword} validation`,
    })),
  }),
});
```

**Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `status` | `number` | No | `422` | HTTP status code for the response |
| `schema` | `Zod/TypeBox/JSON` | No | - | Schema for Swagger documentation |
| `map` | `(error, req) => object` | Yes if `schema` provided | - | Transform AJV errors to your shape |

**Validation Rules:**
- `map` is **required** when `schema` is provided
- `map` is **optional** when no `schema` is provided
- The `map` function receives:
  - `error` - The `SerializedValidationError` object containing AJV errors
  - `req` - The `Request` object for accessing path, method, headers, etc.

The `schema` option automatically updates Swagger documentation for all validated routes.

### Using JSON Schemas Directly

```typescript
@post('/users')
@validate.body({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 18 }
  },
  required: ['name', 'email']
})
async createUser(req: Request, res: Response, body: any) {
  // body parameter contains the validated data
  // req.body also contains the validated data
  res.created(body);
}
```

### Using TypeBox Schemas

TypeBox provides type-safe JSON Schema with full TypeScript type inference. It's a lightweight alternative to Zod with excellent performance.

```typescript
import { Request, Response, validate } from 'balda';
import { Type, Static } from '@sinclair/typebox';

const CreateUserSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  age: Type.Number({ minimum: 18 })
});

type CreateUser = Static<typeof CreateUserSchema>;

@post('/users')
@validate.body(CreateUserSchema)
async createUser(req: Request, res: Response, body: CreateUser) {
  // body is validated and typed
  const { name, email, age } = body;

  res.created({ name, email, age });
}
```

TypeBox also supports advanced schema compositions:

```typescript
import { Type, Static } from "@sinclair/typebox";

// Partial updates
const UpdateUserSchema = Type.Partial(
  Type.Object({
    name: Type.String(),
    email: Type.String({ format: "email" }),
    age: Type.Number({ minimum: 18 }),
  }),
);

// Arrays
const UsersArraySchema = Type.Array(
  Type.Object({
    id: Type.Number(),
    name: Type.String(),
    email: Type.String(),
  }),
);

// Union types
const ResponseSchema = Type.Union([
  Type.Object({ success: Type.Literal(true), data: Type.Any() }),
  Type.Object({ success: Type.Literal(false), error: Type.String() }),
]);

// Optional fields
const QuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
});
```

:::tip TypeBox Caching
TypeBox schemas are automatically cached just like Zod schemas. Each schema object is compiled to AJV once on first use, then reused for all subsequent validations. This makes TypeBox validation extremely fast—especially since TypeBox schemas are already JSON Schema compliant and don't need conversion.
:::

### Using Plain JSON Schemas

Plain JSON schema objects are supported for validation and — unlike Zod or TypeBox — require no extra library. For full **TypeScript type inference**, define your schema `as const` so TypeScript preserves literal types. Balda uses [`json-schema-to-ts`](https://github.com/ThomasAribart/json-schema-to-ts) internally to derive the TypeScript type from the schema.

#### Example

```typescript
const bodySchema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
} as const;

router.post("/", { body: bodySchema }, async (req, res) => {
  return res.json({ name: req.body.name });
});
```

:::warning `as const` is required
Without `as const`, TypeScript widens the schema to a generic object type and inference falls back to `unknown`. Always annotate your plain JSON schemas with `as const`.
Also, you need to install `json-schema-to-ts` to be able to use plain JSON schemas with type inference.

```bash
npm install json-schema-to-ts --save-dev
```

:::

#### Decorator-based validation

```typescript
import { controller, post, validate } from "balda";

const CreateUserSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" },
    age: { type: "integer", minimum: 18 },
  },
  required: ["name", "email", "age"],
  additionalProperties: false,
} as const; // ← required for type inference

@controller("/users")
export class UsersController {
  @post("/")
  @validate.body(CreateUserSchema)
  async createUser(
    req: Request,
    res: Response,
    body: FromSchema<typeof CreateUserSchema>, // { name: string; email: string; age: number }
  ) {
    const { name, email, age } = body; // ✅ fully typed
    res.created({ name, email, age });
  }
}
```

#### Inline route validation

```typescript
import { Server } from "balda";

const CreateUserSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer", minimum: 18 },
  },
  required: ["name", "age"],
  additionalProperties: false,
} as const;

server.router.post("/users", { body: CreateUserSchema }, (req, res) => {
  // req.body is typed as { name: string; age: number }
  const { name, age } = req.body; // ✅ typed
  res.created({ name, age });
});
```

:::tip Performance & Caching
All schemas (Zod, TypeBox, and plain JSON schemas) are compiled once and cached for the lifetime of the server:

- **Zod schemas**: Compiled from Zod → JSON Schema → AJV on first use, then cached
- **TypeBox schemas**: Compiled directly to AJV on first use (already JSON Schema), then cached
- **Plain JSON schemas**: Compiled directly to AJV on first use, then cached

Schema objects are tracked via WeakMap to ensure stable caching across your application. This means **zero compilation overhead** on subsequent requests—validation is as fast as possible after the first use.
:::

:::info Schema Libraries
Both Zod and TypeBox are **peer dependencies** installed only if you use their schemas. They're lazy-loaded at runtime when needed, not bundled if unused.

```bash
# Install Zod (requires zod4 with toJSONSchema() method)
npm install zod

# Install TypeBox
npm install @sinclair/typebox

# Or install both if you want to use them together
npm install zod @sinclair/typebox
```

**Why use Zod?**

- Rich validation API with async refinements support (via `.parseAsync()`)
- Excellent for complex validation logic
- Great ecosystem and community
- Schemas are converted to JSON Schema, then compiled and cached

**Why use TypeBox?**

- Lightweight and fast (generates pure JSON Schema)
- Excellent type inference with `Static<T>`
- Perfect for API-first development
- Smaller bundle size
- Already JSON Schema compliant—compiles directly to AJV for maximum performance

**Caching Behavior:**
Both libraries benefit from automatic schema caching. Define your schemas once, use them everywhere—compilation happens only on first use, then cached for the server's lifetime.

```typescript
// These schemas are compiled once and cached forever
const UserSchema = Type.Object({ name: Type.String() });
const ProductSchema = z.object({ name: z.string() });

// First request: compiles and caches
// All subsequent requests: uses cached compiled schema ⚡
```

Both libraries are first-class citizens in Balda and work seamlessly with validation decorators.

:::

:::warning Synchronous Validation Only
Built-in validation supports **synchronous Zod schemas** only. Async refinements (`.refine(async () => ...)`) are not supported.

For async validation, use Zod's `.parseAsync()` directly:

```typescript
@post('/users')
async createUser(req: Request, res: Response) {
  const result = await CreateUserSchema.safeParseAsync(req.body);  // req.body automatically set by body parser middleware
  if (!result.success) return res.badRequest(result.error);
  res.created(result.data);
}
```

:::

### Custom AJV Instance

You can provide your own AJV instance with custom configuration for advanced use cases:

```typescript
import { Ajv } from "ajv";
import { AjvStateManager } from "balda";

const customAjv = new Ajv({
  validateSchema: false, // Required - must be false
  strict: false, // Required - must be false
  allErrors: true, // Optional - collect all errors
  coerceTypes: true, // Optional - type coercion
  // ... other custom options
});

// Add custom formats
customAjv.addFormat("custom-format", /^[A-Z]{3}-\d{4}$/);

// Add custom keywords
customAjv.addKeyword("isOdd", {
  type: "number",
  validate: (schema: any, data: number) => data % 2 === 1,
});

// Set as global instance (must be called before any validation)
AjvStateManager.setGlobalInstance(customAjv);
```

:::danger Required Configuration
The following AJV options are **required** and must not be changed:

- `validateSchema: false` - Required for proper Zod schema compilation
- `strict: false` - Required for proper Zod schema compilation

Changing these values will cause validation errors and break Zod schema support.
:::

:::tip When to Customize AJV
Consider customizing the AJV instance when you need:

- Custom validation formats (e.g., specific ID patterns)
- Custom validation keywords
- Different error reporting (`allErrors: true`)
- Type coercion (`coerceTypes: true`)
- Performance tuning for specific use cases
  :::

## Response Serialization

Response schemas enable both **type safety** and **fast JSON serialization**. When you define schemas in `responses`, Balda automatically uses [fast-json-stringify](https://github.com/fastify/fast-json-stringify) for high-performance serialization — no `@serialize` decorator needed.

### Inline Route Schemas

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

// Schemas provide both type safety AND fast serialization
router.get(
  "/users",
  {
    responses: {
      200: z.array(UserSchema),
    },
  },
  (req, res) => {
    const users = await userService.findAll();
    res.ok(users); // ✅ Typed as { id: number; name: string; email: string }[]
    // ✅ Serialized with fast-json-stringify
  },
);
```

### Decorator-based Serialization

For controller-based routes, use the `@serialize` decorator to enable fast serialization
Since decorators cannot modify the function signature, the validated data is injected as an additional parameter.

```typescript
import { Request, Response, serialize } from 'balda';
import z from 'zod';
import { Type } from '@sinclair/typebox';

// Using Zod
const UserSchemaZod = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string()
});

@get('/users')
@serialize(z.array(UserSchemaZod))
async getUsers(req: Request, res: Response) {
  const users = await userService.findAll();
  res.json(users);
}

// Using TypeBox
const UserSchemaTypeBox = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  email: Type.String()
});

@get('/users/:id')
@serialize(UserSchemaTypeBox)
async getUser(req: Request, res: Response) {
  const user = await userService.findById(req.params.id);
  res.json(user);
}
```

### Multiple Response Schemas

You can define multiple response schemas for different status codes:

```typescript
import { Request, Response, serialize } from 'balda';
import z from 'zod';
import { Type } from '@sinclair/typebox';

// Using Zod
@get('/users/:id')
@serialize(UserSchemaZod)
@serialize(z.object({ error: z.string() }), { status: 404 })
async getUser(req: Request, res: Response) {
  const user = await userService.findById(req.params.id);

  if (!user) {
    return res.notFound({ error: 'User not found' });
  }

  res.json(user);
}

// Using TypeBox
@get('/users/:id')
@serialize(UserSchemaTypeBox)
@serialize(Type.Object({ error: Type.Literal('User not found') }), { status: 404 })
async getUserTypeBox(req: Request, res: Response) {
  const user = await userService.findById(req.params.id);

  if (!user) {
    return res.notFound({ error: 'User not found' });
  }

  res.json(user);
}
```

### Fast JSON Serialization

Balda automatically uses [fast-json-stringify](https://github.com/fastify/fast-json-stringify) for high-performance JSON serialization when response schemas are available. This can be **2-5x faster** than `JSON.stringify()` for complex objects.

#### When fast-json-stringify is Used

| Scenario                                                   | fast-json-stringify | Standard JSON.stringify |
| ---------------------------------------------------------- | :-----------------: | :---------------------: |
| `responses` schemas in route options                       |         ✅          |                         |
| `@serialize(schema)` decorator present                     |         ✅          |                         |
| `@serialize(schema, { throwErrorOnValidationFail: true })` |         ✅          |                         |
| No schemas defined                                         |                     |           ✅            |

#### How It Works

```typescript
// ✅ Uses fast-json-stringify (schema in responses)
router.get(
  '/users',
  { responses: { 200: UserSchema } },
  (req, res) => {
    res.ok(users);  // Serialized with fast-json-stringify + type-safe
  },
);

// ✅ Uses fast-json-stringify (schema provided via decorator)
@get('/users')
@serialize(UserSchema)
async getUsers(req: Request, res: Response) {
  res.json(users);  // Serialized with fast-json-stringify
}

// ❌ Uses standard JSON.stringify (no schema)
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });  // Serialized with JSON.stringify
});
```

#### Validation Mode

The `@serialize` decorator has a `throwErrorOnValidationFail` option that controls validation behavior:

```typescript
// Validation disabled (default): No validation, uses fast-json-stringify for serialization
@serialize(UserSchema)  // equivalent to @serialize(UserSchema, { throwErrorOnValidationFail: false })

// Validation enabled: Validates response against schema, then uses fast-json-stringify
@serialize(UserSchema, { throwErrorOnValidationFail: true })
```

| Mode                                          | Validation | fast-json-stringify | Use Case                              |
| --------------------------------------------- | :--------: | :-----------------: | ------------------------------------- |
| `throwErrorOnValidationFail: false` (default) |     ❌     |         ✅          | Production - maximum performance      |
| `throwErrorOnValidationFail: true`            |     ✅     |         ✅          | Development - catch schema mismatches |

:::tip Performance Recommendation
Use the default mode (`throwErrorOnValidationFail: false`) in production for best performance. The schema is still used for fast serialization, but validation overhead is skipped.

Use `throwErrorOnValidationFail: true` during development to catch any mismatches between your response data and schema.
:::

#### Schema Caching

All serializers are compiled once and cached for the lifetime of the server:

```typescript
// First request: compiles fast-json-stringify serializer and caches it
// All subsequent requests: reuses cached serializer ⚡

@get('/users')
@serialize(UserSchema)
async getUsers(req: Request, res: Response) {
  res.json(users);  // Uses cached serializer
}
```

You can monitor cache statistics for debugging:

```typescript
import { getSerializerCacheStats } from "balda";

const stats = getSerializerCacheStats();
console.log(`Cached serializers: ${stats.size}`);
console.log(`Schema refs created: ${stats.schemaRefsCreated}`);
```

#### Schema-Only Serialization (Property Stripping)

When a response schema is defined, **only schema-defined properties are included in the response**. Any extra properties on the response object are automatically stripped — they are never sent to the client. This behavior is non-negotiable and applies to all schema types (Zod, TypeBox, plain JSON Schema).

This works similarly to [Fastify's serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/#serialization), with zero runtime overhead:

- **No `delete` operator** — properties are not removed from the source object
- **No recursive object walking** at runtime — the compiled serializer only reads schema-defined keys
- **No data mutation** — the original object is untouched; only the serialized JSON string omits extra properties

```typescript
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

router.get(
  "/users/:id",
  { responses: { 200: UserSchema } },
  async (req, res) => {
    const user = await db.findUser(req.params.id);
    // user = { id: 1, name: "Alice", email: "alice@example.com", passwordHash: "$2b$10$...", role: "admin" }

    res.ok(user);
    // ✅ Response body: { "id": 1, "name": "Alice", "email": "alice@example.com" }
    // ❌ passwordHash and role are NOT included
  },
);
```

This also applies to nested objects and arrays:

```typescript
const TeamSchema = z.object({
  name: z.string(),
  members: z.array(
    z.object({
      id: z.number(),
      displayName: z.string(),
    }),
  ),
});

router.get(
  "/teams/:id",
  { responses: { 200: TeamSchema } },
  async (req, res) => {
    const team = await db.findTeam(req.params.id);
    // team.members[0] = { id: 1, displayName: "Alice", apiKey: "sk-xxx", internalNotes: "..." }

    res.ok(team);
    // ✅ Each member only has { id, displayName }
    // ❌ apiKey and internalNotes are stripped from every array item
  },
);
```

:::warning No Schema = No Stripping
Property stripping only works when a response schema is defined (via `responses` option or `@serialize` decorator). Without a schema, `JSON.stringify` is used and **all properties are included**.

Always define response schemas to prevent leaking sensitive data like passwords, tokens, or internal IDs.
:::

:::info Schema Support
fast-json-stringify works with all schema types:

- **Zod schemas**: Converted to JSON Schema, then compiled
- **TypeBox schemas**: Already JSON Schema compliant, compiled directly
- **Plain JSON schemas**: Compiled directly

All schemas benefit from the same caching mechanism.
:::

## Error Handling

### Custom Error Responses

```typescript
import { Request, Response } from 'balda';

@get('/users/:id')
async getUser(req: Request, res: Response) {
  try {
    const user = await userService.findById(req.params.id);

    if (!user) {
      return res.notFound({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.internalServerError({
      error: 'Failed to fetch user',
      code: 'FETCH_ERROR'
    });
  }
}
```

### Global Error Handler

```typescript
import { Server } from "balda";

server.setErrorHandler((req, res, next, error) => {
  console.error("Error:", error);

  if (error.name === "ValidationError") {
    return res.badRequest({
      error: "Validation failed",
      details: error.message,
    });
  }

  if (error.name === "UnauthorizedError") {
    return res.unauthorized({ error: "Authentication required" });
  }

  res.internalServerError({ error: "Internal server error" });
});
```

## Request Lifecycle

### Middleware Chain

```typescript
import {
  Server,
  controller,
  get,
  post,
  middleware,
  validate,
  cors,
} from "balda";
import { Request, Response } from "balda";
import z from "zod";
import { authMiddleware } from "../auth/auth.md";

// 1. Global middleware
server.use(cors);

// 2. Controller middleware
@controller("/users")
@middleware(authMiddleware)
export class UsersController {
  // 3. Route middleware
  @get("/:id", { middleware: [rateLimit] })
  // 4. Validation
  @validate.params(z.object({ id: z.string() }))
  // 5. Route handler
  async getUser(req: Request, res: Response) {
    // 6. Response serialization
    res.json({ user: req.params.id });
  }
}
```

## TypeScript Support

### Request Extensions

```typescript
import { Request, Response } from 'balda';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@get('/profile')
@middleware(authMiddleware)
async getProfile(req: AuthenticatedRequest, res: Response) {
  // req.user is now typed
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  });
}
```

### Response Types

When using inline route registration with `responses`, each response shorthand method is automatically typed to its status code:

```typescript
import { z } from "zod";
import { Type } from "@sinclair/typebox";

// Zod schemas — response types are inferred automatically
router.get(
  "/users/:id",
  {
    responses: {
      200: z.object({ id: z.string(), name: z.string() }),
      404: z.object({ error: z.string() }),
    },
  },
  (req, res) => {
    res.ok({ id: "1", name: "John" }); // ✅ Typed to 200 schema
    res.notFound({ error: "Not found" }); // ✅ Typed to 404 schema
    // res.ok({ wrong: true });           // ❌ Type error
  },
);

// TypeBox schemas — same inference
router.get(
  "/posts",
  {
    responses: {
      200: Type.Array(Type.Object({ title: Type.String() })),
    },
  },
  (req, res) => {
    res.ok([{ title: "Hello" }]); // ✅ Typed as { title: string }[]
  },
);

// Plain JSON Schema — resolves to `any` (no TS type representation)
router.get(
  "/health",
  {
    responses: {
      200: { type: "object", properties: { status: { type: "string" } } },
    },
  },
  (req, res) => {
    res.ok({ status: "ok" }); // ✅ No type constraints (any)
  },
);
```

For controllers, you can manually type the `Response` generic with a status-code-to-type map:

```typescript
import { Request, Response } from 'balda';

interface User { id: string; name: string; email: string }
interface ApiError { error: string }

@get('/users/:id')
async getUser(
  req: Request<{ id: string }>,
  res: Response<{ 200: User; 404: ApiError }>
) {
  res.ok({ id: "1", name: "John", email: "john@example.com" }); // ✅ Typed as User
  res.notFound({ error: "User not found" });                     // ✅ Typed as ApiError
}
```

:::info Supported Schema Types
| Schema Type | Type Inference | Serialization |
|-------------|:--------------:|:-------------:|
| Zod | ✅ Automatic | ✅ fast-json-stringify |
| TypeBox | ✅ Automatic | ✅ fast-json-stringify |
| JSON Schema | ❌ Resolves to `any` | ✅ fast-json-stringify |
:::

## Best Practices

### 1. Consistent Response Format

```typescript
// Good: Consistent structure
res.json({
  success: true,
  data: { id: 1, name: "John" },
  message: "User created successfully",
});

// Error response
res.badRequest({
  success: false,
  error: "Validation failed",
  details: ["Name is required"],
});
```

### 2. Proper Status Codes

```typescript
// Use appropriate status codes
res.created({ id: 1 }); // 201 for new resources
res.noContent(); // 204 for successful deletion
res.badRequest({ error: "" }); // 400 for client errors
res.notFound({ error: "" }); // 404 for missing resources
```

### 3. Input Validation

```typescript
@post('/users')
@validate.body(CreateUserSchema)
async createUser(req: Request, res: Response, body: CreateUser) {
  // body is validated and typed
  const user = await userService.create(body);
  res.created(user);
}
```

### 4. Error Handling

```typescript
@get('/users/:id')
async getUser(req: Request, res: Response) {
  try {
    const user = await userService.findById(req.params.id);

    if (!user) {
      return res.notFound({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Database error:', error);
    res.internalServerError({ error: 'Failed to fetch user' });
  }
}
```

### 5. Security Headers

```typescript
// Set security headers
res.setHeaders({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
});
```

The request and response objects in Balda provide a powerful and intuitive API for building robust web applications with proper error handling, validation, and type safety.
