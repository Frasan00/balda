---
title: Async Local Storage Plugin
description: Request-scoped context management with Node.js AsyncLocalStorage. Access request data anywhere without passing parameters.
keywords: [balda, async local storage, context, request scope, als]
sidebar_position: 6
---

# Async Local Storage Plugin

Provides a powerful context management system using Node.js AsyncLocalStorage. This plugin allows you to store and access request-scoped data throughout your application without explicitly passing it through function parameters.

## Quick Start

```typescript
import { Server, asyncStorage } from "balda";

const server = new Server({
  plugins: {
    asyncLocalStorage: {
      id: () => Math.random().toString(36).substring(2, 15),
    },
  },
});
```

## Extending the Context

To add custom properties to the context, extend the `AsyncLocalStorageContext` interface using module augmentation:

```typescript
declare module "balda" {
  interface AsyncLocalStorageContext {
    id: string;
  }
}
```

This TypeScript declaration ensures type safety when accessing context properties throughout your application.

## Configuration

The plugin accepts an object where each key represents a context property, and the value is a setter function that returns the value for that property:

```typescript
plugins: {
  asyncLocalStorage: {
    id: () => crypto.randomUUID(),
    userId: (req) => req.rawHeaders.get('x-user-id'),
    requestId: () => Math.random().toString(36).substring(2, 15)
  }
}
```

### Setter Functions

Setter functions can:

- Accept the `Request` object as a parameter
- Return values synchronously or asynchronously
- Access request headers, query parameters, or any request data

```typescript
plugins: {
  asyncLocalStorage: {
    // Simple value
    requestId: () => crypto.randomUUID(),

    // From request
    userId: (req) => req.rawHeaders.get('x-user-id'),

    // Async operation
    tenant: async (req) => await getTenantFromToken(req.rawHeaders.get('authorization'))
  }
}
```

## Accessing Context in Routes

### Using req.ctx

The most common way to access context is through the `req.ctx` property:

```typescript
server.get("/async-local-storage", async (req, res) => {
  // Access context via req.ctx
  return res.ok({ id: req.ctx.id });
});
```

### Using asyncStorage.getStore()

For accessing context outside of route handlers (like in services, utilities, or helper functions), use the `asyncStorage` export:

```typescript
import { asyncStorage } from "balda";

server.get("/async-local-storage", async (req, res) => {
  // Access context directly via asyncStorage
  const ctx = asyncStorage.getStore();
  console.log(ctx);

  return res.ok({ id: req.ctx.id });
});
```

## Context in Services

Access context in service layers without prop drilling:

```typescript
// logger.service.ts
import { asyncStorage } from "balda";

export function log(message: string, level: string = "info") {
  const ctx = asyncStorage.getStore();

  console.log(
    JSON.stringify({
      level,
      message,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      timestamp: new Date().toISOString(),
    }),
  );
}

// user.service.ts
import { asyncStorage } from "balda";
import { log } from "./logger.service";

export async function createUser(userData: any) {
  const ctx = asyncStorage.getStore();

  log(`Creating user for tenant ${ctx?.tenantId}`);

  // User creation logic
  const user = await db.users.create({
    ...userData,
    tenantId: ctx?.tenantId,
    createdBy: ctx?.userId,
  });

  log(`User created: ${user.id}`);

  return user;
}
```

## Best Practices

### Type Safety

Always declare types for your context properties:

```typescript
declare module "balda" {
  interface AsyncLocalStorageContext {
    requestId: string;
    userId?: string; // Optional properties should be marked
  }
}
```

### Async Setters

Use async setters when you need to fetch data:

```typescript
asyncLocalStorage: {
  organizationId: async (req) => {
    const userId = req.user.id;
    return await getOrganizationForUser(userId);
  };
}
```

## Common Patterns

### Request Logging

```typescript
import { asyncStorage } from "balda";

server.use((req, res, next) => {
  const ctx = asyncStorage.getStore();
  console.log(`[${ctx?.requestId}] ${req.method} ${req.url}`);
  next();
});
```

## Limitations

- Context is only available within the async execution flow of a request
- Context is lost when using callbacks or setTimeout without proper binding
- Not suitable for sharing data between different requests

## Related Plugins

- [Cookie Plugin](./cookie) - For client-side state management
- [Log Plugin](./log) - Enhanced logging with context support
