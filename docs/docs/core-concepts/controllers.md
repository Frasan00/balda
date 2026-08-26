---
title: Controllers
description: Organize route handlers with decorator-based controllers. Define HTTP endpoints with @get, @post, @put, @delete decorators.
keywords: [balda, controllers, decorators, routes, endpoints, class]
sidebar_position: 2
---

# Controllers

Controllers are the heart of your Balda application. They organize your route handlers into logical groups and provide a clean, decorator-based API for defining HTTP endpoints.

## Basic Controller

```typescript
import { controller, get, post } from "balda";
import { Request, Response } from "balda";

@controller("/users")
export class UsersController {
  @get("/")
  async getAllUsers(req: Request, res: Response) {
    res.json({ users: [] });
  }

  @post("/")
  async createUser(req: Request, res: Response) {
    res.created(req.body);
  }
}
```

## Controller Decorator

The `@controller()` decorator marks a class as a controller and defines the base path for all routes within that controller.

```typescript
@controller(path?: string, swaggerOptions?: SwaggerRouteOptions)
```

### Parameters

- `path` (optional): Base path for all routes in the controller
- `swaggerOptions` (optional): Swagger documentation options for the controller

### Examples

```typescript
// Simple controller
@controller("/users")
export class UsersController {}

// Controller with Swagger options
@controller("/users", {
  tags: ["Users"],
  summary: "User management endpoints",
})
export class UsersController {}
```

## HTTP Method Decorators

Balda provides decorators for all HTTP methods:

```typescript
@controller("/users")
export class UsersController {
  @get("/")
  getAll(req, res) {
    res.json({ users: [] });
  }

  @get("/:id")
  getById(req, res) {
    res.json({ user: { id: req.params.id } });
  }

  @post("/")
  create(req, res) {
    res.created(req.body);
  }

  @put("/:id")
  update(req, res) {
    res.json({ id: req.params.id, ...req.body });
  }

  @patch("/:id")
  partialUpdate(req, res) {
    res.json({ id: req.params.id, ...req.body });
  }

  @del("/:id")
  delete(req, res) {
    res.noContent();
  }
}
```

## Route Options

HTTP method decorators accept various options:

```typescript
// Middleware
@get('/', { middleware: [authMiddleware] })
getAll(req, res) { res.json({ users: [] }); }

// Body type for file uploads or form data
@post('/upload', { bodyType: 'form-data' })
upload(req, res) {
  const file = req.file('fieldName');
  res.ok({ filename: file.originalName });
}

// URL-encoded form data
@post('/form', { bodyType: 'urlencoded' })
handleForm(req, res) { res.ok(req.body); }

// Swagger documentation
@get('/', {
  swagger: {
    summary: 'Get all users',
    description: 'Retrieve a list of all users'
  }
})
getAll(req, res) { res.json({ users: [] }); }
```

### Available Options

- `middleware`: Middleware array for this route
- `bodyType`: `'json'` | `'urlencoded'` | `'form-data'` (default: `'json'`)
- `swagger`: OpenAPI documentation metadata

## Validation and Serialization

Balda supports **Zod**, **TypeBox**, and **OpenAPI/AJV** schemas for validation and serialization:

### Request Validation

```typescript
import { z } from "zod";
import { Type } from "@sinclair/typebox";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Or with TypeBox
const CreateUserTypeBox = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: "email" }),
});

// Or with OpenAPI/AJV
const CreateUserOpenApi = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["name", "email"],
} as const;

@controller("/users")
export class UsersController {
  @post("/")
  @validate.body(CreateUserSchema) // Body validation
  create(req, res, body) {
    // body is validated and typed
    res.created(body);
  }

  @get("/")
  @validate.query(z.object({ page: z.string().optional() })) // Query validation
  getAll(req, res, query) {
    // query is validated
    res.json({ users: [], page: query.page });
  }
}
```

### Response Serialization

Multiple `@serialize` decorators can be stacked for different status codes:

```typescript
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

@controller("/users")
export class UsersController {
  @get("/:id")
  @serialize(UserSchema) // Default 200 response
  @serialize(ErrorSchema, { status: 404 }) // 404 response
  getById(req, res) {
    const user = findUser(req.params.id);
    user ? res.json(user) : res.notFound({ error: "Not found" });
  }

  @post("/")
  @serialize(UserSchema, { status: 201 }) // Success response
  @serialize(ErrorSchema, { status: 409 }) // Conflict response
  @serialize(ErrorSchema, { status: 400, throwErrorOnValidationFail: true }) // Validation enabled
  create(req, res, body) {
    res.created(body);
  }
}
```

### Serialize Options

- `status`: HTTP status code for this schema (default: 200)
- `throwErrorOnValidationFail`: Whether to validate the response and throw on mismatch (default: false)

## Controller-Level Middleware

Apply middleware to all routes in a controller:

```typescript
@controller("/users")
@middleware(authMiddleware)
export class UsersController {
  @get("/")
  getAll(req, res) {
    // Uses authMiddleware
    res.json({ users: [] });
  }

  @get("/public")
  @middleware(publicMiddleware) // Override
  getPublic(req, res) {
    // Uses publicMiddleware instead
    res.json({ users: [] });
  }
}
```

## Complete Controller Example

```typescript
import {
  controller,
  get,
  post,
  put,
  del,
  middleware,
  validate,
  serialize,
} from "balda";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

@controller("/users")
@middleware(loggerMiddleware)
export class UsersController {
  private users = [{ id: 1, name: "Alice", email: "alice@example.com" }];

  @get("/")
  @serialize(z.array(UserSchema))
  getAll(req, res) {
    res.json(this.users);
  }

  @get("/:id")
  @serialize(UserSchema)
  getById(req, res) {
    const user = this.users.find((u) => u.id === Number(req.params.id));
    user ? res.json(user) : res.notFound({ error: "User not found" });
  }

  @post("/")
  @validate.body(CreateUserSchema)
  @serialize(UserSchema)
  create(req, res, body) {
    const user = { id: this.users.length + 1, ...body };
    this.users.push(user);
    res.created(user);
  }

  @put("/:id")
  @middleware(authMiddleware)
  @validate.body(CreateUserSchema)
  update(req, res, body) {
    const id = Number(req.params.id);
    const index = this.users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res.notFound({ error: "User not found" });
    }

    this.users[index] = { ...this.users[index], ...body };
    res.json(this.users[index]);
  }

  @del("/:id")
  @middleware(authMiddleware)
  delete(req, res) {
    const id = Number(req.params.id);
    const index = this.users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res.notFound({ error: "User not found" });
    }

    this.users.splice(index, 1);
    res.noContent();
  }
}
```

## Controller Organization

### File Structure

```
src/
├── controllers/
│   ├── users.controller.ts
│   ├── posts.controller.ts
│   ├── auth.controller.ts
│   └── index.ts
```

### Controller Registration

Controllers are automatically registered when the server starts. Make sure your controller files match the patterns specified in your server configuration:

```typescript
const server = new Server({
  controllerPatterns: ["./src/controllers/**/*.ts"],
});
```

### Controller Index

You can create an index file to export all controllers:

```typescript
// src/controllers/index.ts
export * from "./users.controller";
export * from "./posts.controller";
export * from "./auth.controller";
```

## Best Practices

1. **Single Responsibility** - One controller per resource or feature
2. **Consistent Naming** - Use clear, descriptive names (e.g., `UsersController`, `AuthController`)
3. **Use Validation** - Always validate request bodies with `@validate.body()`
4. **Use Serialization** - Define response schemas with `@serialize()` for type safety
5. **Middleware Placement** - Apply auth/logging at controller level, specific checks at route level
6. **Error Handling** - Return appropriate HTTP status codes (`notFound`, `badRequest`, etc.)

```typescript
// Good example combining best practices
@controller("/users")
@middleware(loggerMiddleware)
export class UsersController {
  @post("/")
  @validate.body(CreateUserSchema)
  @serialize(UserSchema)
  create(req, res, body) {
    const user = userService.create(body);
    res.created(user);
  }
}
```
