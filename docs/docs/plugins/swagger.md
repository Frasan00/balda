---
title: Swagger Plugin
description: Auto-generate OpenAPI 3.0 documentation from your Balda API. Interactive Swagger UI at /docs endpoint.
keywords: [balda, swagger, openapi, documentation, api docs]
sidebar_position: 9
---

# Swagger Plugin

The Swagger plugin automatically generates OpenAPI 3.0 documentation for your Balda API.

## Features

- **Automatic Route Discovery**: Automatically discovers and documents all your routes
- **Multiple UI Options**: Choose between Swagger UI, ReDoc, or RapiDoc
- **Type Integration**: Uses your validation schemas to generate accurate request/response documentation
- **Security Support**: Document authentication schemes and security requirements
- **Custom Models**: Define reusable data models for your API

## Global Configuration

### Basic Setup

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  swagger: {
    type: "standard", // "standard" | "redoc" | "rapidoc"
    path: "/docs",
    title: "My API Documentation",
    description: "API documentation for my application",
    version: "1.0.0",
    servers: ["http://localhost:3000"],
  },
});
```

### Advanced Configuration

```typescript
const server = new Server({
  port: 3000,
  swagger: {
    type: "standard",
    path: "/api-docs",
    title: "E-Commerce API",
    description: "Complete API for our e-commerce platform",
    version: "2.1.0",
    servers: [
      "http://localhost:3000",
      "https://api.staging.example.com",
      "https://api.example.com",
    ],
    models: {
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["email", "name"],
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          category: { type: "string" },
        },
        required: ["name", "price"],
      },
    },
  },
});
```

## Route-Level Documentation

### Basic Route Documentation

#### With Controller Decorators

```typescript
import { controller, get, post, validate } from "balda";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  password: z.string().min(8),
});

const UserResponse = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

@controller("/users")
export class UsersController {
  @get("/", {
    swagger: {
      name: "Get All Users",
      description: "Retrieve a list of all users",
      service: "users",
      responses: {
        200: z.array(UserResponse),
      },
    },
  })
  async getAllUsers(req: Request, res: Response) {
    const users = await getUsers();
    res.json(users);
  }

  @post("/")
  @validate.body(CreateUserSchema) // Body schema for validation
  async createUser(
    req: Request,
    res: Response,
    body: z.infer<typeof CreateUserSchema>,
  ) {
    const user = await createUser(body);
    res.created({ user, message: "User created successfully" });
  }
}
```

#### With Inline Routes

```typescript
import { Server } from "balda";
import { z } from "zod";

const server = new Server({ port: 3000 });

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  password: z.string().min(8),
});

// Inline validation - automatically documents in Swagger
server.router.post(
  "/users",
  {
    body: CreateUserSchema, // Automatically added to Swagger docs
    responses: {
      201: UserResponse,
      400: ErrorSchema,
    },
    swagger: {
      name: "Create User",
      description: "Create a new user account",
      service: "users",
    },
  },
  (req, res) => {
    // req.body is typed and validated
    const user = createUser(req.body);
    res.created({ user, message: "User created successfully" });
  },
);

// Query validation
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

server.router.get(
  "/users",
  {
    query: PaginationSchema, // Automatically added to Swagger docs
    responses: {
      200: z.array(UserResponse),
    },
    swagger: {
      name: "List Users",
    },
  },
  (req, res) => {
    const users = getUsersPaginated(req.query.page, req.query.limit);
    res.json(users);
  },
);
```

:::tip Automatic Schema Documentation
When you specify `body` or `query` at the route level, they're automatically included in the Swagger documentation. You don't need to specify them again in the `swagger` options.
:::

### Path Parameters

```typescript
@get('/:id', {
  swagger: {
    name: "Get User by ID",
    description: "Retrieve a specific user by their ID",
    service: "users",
    params: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" }
      }
    },
    responses: {
      "200": { $ref: "#/components/schemas/User" },
      "404": {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      }
    }
  }
})
async getUserById(req: Request, res: Response) {
  const { id } = req.params;
  const user = await getUserById(id);
  if (!user) {
    return res.notFound({ error: "User not found" });
  }
  res.json(user);
}
```

### Query Parameters

```typescript
@get('/search', {
  swagger: {
    name: "Search Users",
    description: "Search users with filters",
    service: "users",
    query: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query" },
        limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
        offset: { type: "number", minimum: 0, default: 0 },
        sort: { type: "string", enum: ["name", "email", "createdAt"] }
      },
      required: ["q"]
    },
    responses: {
      "200": {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: { $ref: "#/components/schemas/User" }
          },
          total: { type: "number" },
          limit: { type: "number" },
          offset: { type: "number" }
        }
      }
    }
  }
})
async searchUsers(req: Request, res: Response) {
  const { q, limit = 10, offset = 0, sort } = req.query;
  const result = await searchUsers({ q, limit, offset, sort });
  res.json(result);
}
```

### Security Requirements

```typescript
@post('/profile', {
  swagger: {
    name: "Update Profile",
    description: "Update user profile (requires authentication)",
    service: "users",
    security: [
      { type: "bearer", bearerFormat: "JWT" }
    ],
    requestBody: {
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" }
      }
    },
    responses: {
      "200": { $ref: "#/components/schemas/User" },
      "401": {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      }
    }
  }
})
async updateProfile(req: Request, res: Response) {
  // Implementation with authentication
  const user = await updateUserProfile(req.user.id, req.body);
  res.json(user);
}
```

### File Upload Documentation

```typescript
@post('/avatar', {
  swagger: {
    name: "Upload Avatar",
    description: "Upload user avatar image",
    service: "users",
    bodyType: "form-data",
    requestBody: {
      type: "object",
      properties: {
        avatar: {
          type: "string",
          format: "binary",
          description: "Avatar image file"
        }
      },
      required: ["avatar"]
    },
    responses: {
      "200": {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          message: { type: "string" }
        }
      }
    }
  }
})
async uploadAvatar(req: Request, res: Response) {
  const file = req.files.avatar;
  const url = await uploadFile(file);
  res.json({ url, message: "Avatar uploaded successfully" });
}
```

### Excluding Routes

```typescript
@get('/internal/health', {
  swagger: {
    excludeFromSwagger: true
  }
})
async healthCheck(req: Request, res: Response) {
  res.json({ status: "ok" });
}
```

## UI Options

### Swagger UI (Standard)

```typescript
swagger: {
  type: "standard",
  path: "/docs"
}
```

### ReDoc

```typescript
swagger: {
  type: "redoc",
  path: "/docs"
}
```

### RapiDoc

```typescript
swagger: {
  type: "rapidoc",
  path: "/docs"
}
```

## Integration with Validation

Balda automatically integrates your validation schemas with Swagger documentation:

```typescript
import z from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8)
});

@post('/', {
  validate: { body: CreateUserSchema },
  swagger: {
    name: "Create User",
    requestBody: CreateUserSchema,
    responses: {
      "201": { $ref: "#/components/schemas/User" },
      "400": { $ref: "#/components/schemas/ValidationError" }
    }
  }
})
async createUser(req: Request, res: Response) {
  // The validation schema automatically becomes the OpenAPI schema
  const user = await createUser(req.body);
  res.created(user);
}
```

## Validation Error Response Documentation

When routes have validation schemas (`body`, `query`, or `all`), Balda automatically documents the validation error response in Swagger. This helps consumers understand what error format to expect when sending invalid data.

### Default Behavior

By default, routes with validation schemas receive a `422 Unprocessable Entity` response with a detailed error schema:

```json
{
  "message": "string",
  "errors": [
    {
      "instancePath": "string",
      "schemaPath": "string",
      "keyword": "string",
      "params": {},
      "message": "string"
    }
  ],
  "ajv": true,
  "validation": true
}
```

### Global Configuration

Configure the validation error response globally in your server configuration:

```typescript
const server = new Server({
  port: 3000,
  swagger: {
    type: "standard",
    path: "/docs",
    validationErrorResponse: {
      statusCode: 422, // Use 422 Unprocessable Entity instead of 400
      description: "Validation failed - request body or query parameters are invalid",
      schema: {
        type: "object",
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string", example: "Validation failed" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string", example: "email" },
                message: { type: "string", example: "Invalid email format" },
              },
            },
          },
        },
      },
    },
  },
});
```

### Per-Route Override

Override the validation error response for specific routes:

```typescript
router.post(
  "/users",
  {
    body: z.object({
      email: z.string().email(),
      name: z.string(),
    }),
    swagger: {
      name: "Create User",
      validationErrorResponse: {
        statusCode: 400,
        description: "Invalid user data provided",
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
            fields: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
  async (req, res) => {
    res.json({ success: true });
  }
);
```

### Aligning with Custom Error Handler

If you use a custom validation error handler with `server.setValidationErrorHandler()`, the schema you provide automatically updates Swagger documentation:

```typescript
import { z } from "zod";

// Set custom error handler with schema
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
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details: error.errors.map(e => ({
      field: e.instancePath,
      issue: e.message,
    })),
  }),
});

// The schema above automatically becomes the default validation error response
// in Swagger for all validated routes. No additional configuration needed!
```

### Which Schemas Trigger Error Documentation

The validation error response is documented when routes have any of these validation schemas:

- `body` - Request body validation
- `query` - Query parameter validation
- `all` - Combined body/query validation

**Note:** `headers` validation does NOT trigger validation error documentation, as header validation failures typically result in authentication/authorization errors rather than validation errors.

## Accessing Documentation

Once configured, your API documentation will be available at:

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/docs/json`

The JSON specification can be used with other OpenAPI tools or imported into external documentation systems.

## Best Practices

1. **Use Descriptive Names**: Give your routes meaningful names and descriptions
2. **Group Related Routes**: Use the `service` property to group related endpoints
3. **Document All Responses**: Include success and error responses
4. **Use Reusable Models**: Define models in the global configuration for reuse
5. **Keep Security Simple**: Use standard security schemes when possible
6. **Test Your Documentation**: Use the generated documentation to test your API
