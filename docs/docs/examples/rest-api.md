---
title: REST API Example
description: Complete REST API example with authentication, validation, services, and middleware. Production-ready structure.
keywords: [balda, rest api, example, authentication, validation]
sidebar_position: 1
---

# REST API Example

A complete REST API example with authentication, validation, and services.

## Project Structure

```
src/
├── controllers/
│   └── users.controller.ts
├── middleware/
│   └── auth.middleware.ts
├── schemas/
│   └── user.schema.ts
├── services/
│   └── user.service.ts
└── server.ts
```

## Server Setup

```typescript
// src/server.ts
import { Server } from "balda";

const server = new Server({
  port: 3000,
  controllerPatterns: ["./src/controllers/**/*.ts"],
  plugins: {
    cors: { origin: "*" },
    bodyParser: { json: { sizeLimit: "10mb" } },
  },
});

server.setErrorHandler((req, res, next, error) => {
  if (error.name === "ValidationError") {
    return res.badRequest({ error: error.message });
  }
  res.internalServerError({ error: "Server error" });
});

server.listen(({ port }) => {
  console.log(`Server running on http://localhost:${port}`);
});
```

## Schemas

```typescript
// src/schemas/user.schema.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type User = z.infer<typeof UserSchema>;
```

## Service

```typescript
// src/services/user.service.ts
import { User, CreateUser } from "../schemas/user.schema";

class UserService {
  private users: User[] = [];
  private nextId = 1;

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findById(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) || null;
  }

  async create(data: CreateUser): Promise<User> {
    if (await this.findByEmail(data.email)) {
      throw new Error("Email already exists");
    }

    const user: User = {
      id: this.nextId++,
      name: data.name,
      email: data.email,
    };

    this.users.push(user);
    return user;
  }

  async delete(id: number): Promise<boolean> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    this.users.splice(index, 1);
    return true;
  }
}

export const userService = new UserService();
```

## Middleware

```typescript
// src/middleware/auth.middleware.ts
import { userService } from "../services/user.service";

export const authMiddleware = async (req, res, next) => {
  const token = req.rawHeaders.get('authorization')?.replace("Bearer ", "");

  if (!token) {
    return res.unauthorized({ error: "Token required" });
  }

  try {
    // In production, verify JWT token
    // For demo, using user ID as token
    const user = await userService.findById(Number(token));

    if (!user) {
      return res.unauthorized({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch {
    return res.unauthorized({ error: "Invalid token" });
  }
};
```

## Controller

```typescript
// src/controllers/users.controller.ts
import {
  controller,
  get,
  post,
  del,
  validate,
  serialize,
  middleware,
} from "balda";
import { z } from "zod";
import {
  CreateUserSchema,
  UserSchema,
  LoginSchema,
} from "../schemas/user.schema";
import { userService } from "../services/user.service";
import { authMiddleware } from "../middleware/auth.middleware";

@controller("/users")
export class UsersController {
  @get("/")
  @serialize(z.array(UserSchema))
  async getAll(req, res) {
    const users = await userService.findAll();
    res.json(users);
  }

  @get("/:id")
  @serialize(UserSchema)
  async getById(req, res) {
    const user = await userService.findById(Number(req.params.id));
    user ? res.json(user) : res.notFound({ error: "User not found" });
  }

  @post("/")
  @validate.body(CreateUserSchema)
  @serialize(UserSchema)
  async create(req, res, body) {
    try {
      const user = await userService.create(body);
      res.created(user);
    } catch (error) {
      return res.conflict({ error: error.message });
    }
  }

  @del("/:id")
  @middleware(authMiddleware)
  async delete(req, res) {
    const id = Number(req.params.id);

    if (req.user.id !== id) {
      return res.forbidden({ error: "Cannot delete other users" });
    }

    const deleted = await userService.delete(id);
    deleted ? res.noContent() : res.notFound({ error: "User not found" });
  }

  @post("/login")
  @validate.body(LoginSchema)
  async login(req, res, body) {
    const user = await userService.findByEmail(body.email);

    if (!user) {
      return res.unauthorized({ error: "Invalid credentials" });
    }

    // In production, verify password hash
    res.json({
      token: user.id.toString(),
      user,
    });
  }
}
```

## Testing

```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'

# Get all users
curl http://localhost:3000/users

# Delete user (requires auth)
curl -X DELETE http://localhost:3000/users/1 \
  -H "Authorization: Bearer 1"
```

## Key Takeaways

- **Controllers** organize routes by feature
- **Services** handle business logic and data access
- **Middleware** adds cross-cutting concerns like authentication
- **Validation** ensures request data integrity with Zod schemas
- **Serialization** defines response structure and generates OpenAPI docs

See [Core Concepts](../core-concepts/server) for more details on each component.
