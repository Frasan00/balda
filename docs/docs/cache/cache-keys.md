---
title: Cache Keys
description: Understand cache key generation from request data. Control granularity and avoid key collisions.
keywords: [balda, cache, keys, hashing, granularity]
sidebar_position: 3
---

# Cache Keys

Every cached route gets a unique key computed from the request. Understanding how keys are generated helps you control cache granularity and avoid collisions.

## Default Key Structure

Cache keys follow this format:

```
{prefix}:{METHOD}:{pathname}:{params}:{extra}
```

- **`prefix`** — `keyPrefix` from server options (default: `cache`)
- **`METHOD`** — HTTP method (e.g. `GET`, `POST`)
- **`pathname`** — request path without query string (e.g. `/api/users/42`)
- **`params`** — route parameters are always included (e.g. `id=42`)
- **`extra`** — SHA-256 hash of any additional fields (body, query, headers, custom discriminator)

Route parameters are **always** part of the key — no configuration needed.

## The `include` Option

Use `include` on the cache config to control which additional request data is hashed into the key.

### Include query string

```ts
// Decorator
@cache({ ttl: 60, include: { query: true } })

// Inline router
server.router.get('/products', { cache: { ttl: 60, include: { query: true } } }, handler);
```

Specific fields only:

```ts
@cache({ ttl: 60, include: { query: ['page', 'limit'] } })
```

### Include request body

```ts
@post('/search')
@cache({ ttl: 30, include: { body: true } })
async search(req, res) { /* ... */ }
```

Specific body fields:

```ts
@cache({ ttl: 30, include: { body: ['q', 'filters'] } })
```

### Include headers

```ts
@cache({ ttl: 120, include: { headers: ['x-tenant-id'] } })
```

Useful for tenant-aware caching where different tenants must not share cached data.

### Custom discriminator (`fromRequest`)

For any request-derived value not covered by body/query/headers, use `fromRequest`. Its return value is hashed and appended to the key.

```ts
@cache({
  ttl: 60,
  include: {
    fromRequest: (req) => req.rawHeaders.get('x-user-role'),
  },
})
```

## Type-Safe Picks (inline router only)

When you register routes with schemas via the inline router, the `include` picks are fully type-safe — TypeScript will only allow valid field names from your schema.

```ts
import { z } from "zod";

const querySchema = z.object({
  page: z.number(),
  limit: z.number(),
  status: z.string(),
});

server.router.get(
  "/orders",
  {
    query: querySchema,
    cache: {
      ttl: 60,
      include: {
        query: ["page", "limit"], // ✅ TypeScript checks these against querySchema
      },
    },
  },
  (req, res) => {
    res.json(req.query); // req.query is fully typed
  },
);
```

:::note
The `@cache()` decorator does not have access to schema types at compile time, so `include` field picks are not type-checked in decorators. Use the inline router config for type-safe picks.
:::

## Combining `include` Options

All `include` options can be combined:

```ts
@cache({
  ttl: 60,
  include: {
    query: ['page'],
    headers: ['x-tenant-id'],
    fromRequest: (req) => req.rawHeaders.get('accept-language'),
  },
})
```

Each non-empty part is JSON-serialized in a stable order, concatenated, and SHA-256 hashed to form the key suffix.
