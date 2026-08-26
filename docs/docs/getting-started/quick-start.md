---
title: Quick Start
description: Build your first Balda API in 5 minutes. Create a server, add routes, validation, and view auto-generated Swagger docs.
keywords: [balda, quick start, tutorial, api, rest, getting started, example]
sidebar_position: 2
---

# Quick Start

Build your first Balda API in 5 minutes.

## 1. Create a Server

Create `server.ts`:

```typescript
import { Server, router } from "balda";

const server = new Server({ host: "0.0.0.0", port: 3000 });

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

router.group("/users", (usersRouter) => {
  usersRouter.get("/", (req, res) => {
    res.json(users);
  });

  usersRouter.get("/:id", (req, res) => {
    const user = users.find((u) => u.id === Number(req.params.id));
    user ? res.json(user) : res.notFound({ error: "User not found" });
  });

  usersRouter.post("/", (req, res) => {
    const user = { id: users.length + 1, ...req.body };
    users.push(user);
    res.created(user);
  });
});

server.listen(() => console.log("Server running on http://localhost:3000"));
```

## 2. Run the Server

Using the CLI (recommended):

```bash
npx balda serve
```

Or run directly:

```bash
# Node.js
npx tsx server.ts

# Bun
bun server.ts

# Deno
deno run --allow-net server.ts
```

## 3. Test Your API

```bash
# Get all users
curl http://localhost:3000/users

# Get a specific user
curl http://localhost:3000/users/1

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Charlie"}'
```

## Add Validation

Add request validation with Zod, TypeBox, or OpenAPI schemas:

```typescript
import { Server, router } from "balda";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1),
});

router.group("/users", (usersRouter) => {
  usersRouter.post(
    "/",
    { body: CreateUserSchema }, // Also supports query, headers options
    (req, res, body) => {
      // body is now validated and typed
      const user = { id: users.length + 1, ...body };
      users.push(user);
      res.created(user);
    },
  );
});
```

:::info
Balda supports **Zod**, **TypeBox (@sinclair/typebox)**, and **OpenAPI/AJV** schemas for validation and serialization.
:::

## View API Documentation

Balda automatically generates Swagger docs at `/docs`:

```
http://localhost:3000/docs
```

## Next Steps

- Learn about [Controllers](../core-concepts/controllers) and routing patterns
- Add [Middleware](../core-concepts/middleware) for authentication and logging
- Configure [Plugins](../plugins/overview) like CORS, rate limiting, and more
- See a [Complete REST API Example](../examples/rest-api) with services and auth
