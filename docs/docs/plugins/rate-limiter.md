---
title: Rate Limiter Plugin
description: Protect APIs from abuse with IP-based and custom key rate limiting. Prevent DDoS and brute force attacks.
keywords: [balda, rate limiter, throttling, ddos, abuse, protection]
sidebar_position: 7
---

# Rate Limiter Plugin

Protects your application from abuse by limiting the number of requests a client can make within a specified time window. Supports both IP-based and custom key-based rate limiting.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    rateLimiter: {
      keyOptions: { limit: 100 },
      storageOptions: { windowMs: 60_000 }, // 1 minute
    },
  },
});
```

## Configuration

### IP-Based Limiting

When the app runs behind a reverse proxy, register the **[Trust Proxy](./trust-proxy)** plugin **before** the rate limiter so `req.ip` reflects the real client, not the load balancer.

```typescript
rateLimiter: {
  keyOptions: {
    type: "ip",
    limit: 100,               // Requests per window
  },
  storageOptions: {
    windowMs: 60_000,         // Time window in ms (1 minute)
  },
}
```

### Custom Key-Based Limiting

Set `type: "custom"` and supply a `key` function:

```typescript
rateLimiter: {
  keyOptions: {
    type: "custom",
    key: (req) => req.rawHeaders.get("X-API-Key") ?? req.ip,
    limit: 50,
  },
  storageOptions: {
    windowMs: 60_000,
  },
}
```

### Storage Configuration

Storage is the **second** argument, not part of `keyOptions`. Passing it inline is ignored:

```typescript
import { rateLimiter } from "balda";

rateLimiter(
  { type: "ip", limit: 100 },
  { type: "memory", windowMs: 60_000, maxKeys: 100_000 },
);
```

When registered as a plugin, the same two objects are `keyOptions` and `storageOptions`:

```typescript
rateLimiter: {
  keyOptions: { type: "ip", limit: 100 },
  storageOptions: { type: "memory", windowMs: 60000 }
}
```

## Usage

The limiter takes the same two arguments everywhere: `rateLimiter(keyOptions, storageOptions)`.
Registering it as a plugin just splits them into `keyOptions` / `storageOptions`.

### Global Rate Limiting

```typescript
const server = new Server({
  plugins: {
    rateLimiter: {
      keyOptions: { limit: 100 },
      storageOptions: { windowMs: 60_000 }, // 100 requests per minute
    },
  },
});

@controller("/api")
export class ApiController {
  @get("/users")
  async getUsers(req: Request, res: Response) {
    // Rate limited to 100 requests per minute per IP
    const users = await getUsers();
    res.json(users);
  }
}
```

### Route-Level Rate Limiting

```typescript
import { rateLimiter } from "balda";

@controller("/api")
export class ApiController {
  @get("/public", {
    middleware: [rateLimiter({ limit: 1000 }, { windowMs: 60_000 })],
  })
  async publicEndpoint(req: Request, res: Response) {
    // 1000 requests per minute
    res.json({ message: "Public endpoint" });
  }

  @post("/auth/login", {
    middleware: [
      rateLimiter({ limit: 5 }, { windowMs: 15 * 60 * 1000 }), // 15 minutes
    ],
  })
  async login(req: Request, res: Response) {
    // 5 requests per 15 minutes (prevent brute force)
    const user = await authenticateUser(req.body);
    res.json(user);
  }
}
```

### Custom Key Function

```typescript
rateLimiter: {
  keyOptions: {
    type: "custom",
    key: (req) => {
      // Rate limit by user ID if authenticated, IP otherwise
      const userId = req.user?.id;
      return userId ?? req.ip;
    },
    limit: 100,
  },
  storageOptions: { windowMs: 60_000 },
}
```

## Error Response

Rejected requests return `statusCode` (default 429) with a `code` and `message`:

```json
// Response: 429 Too Many Requests
{
  "message": "ERR_RATE_LIMIT_EXCEEDED",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Both are configurable — `message` for humans, `code` for clients that branch on it:

```typescript
rateLimiter({
  type: "ip",
  limit: 100,
  message: "Slow down.",
  code: "RATE_LIMITED",
  statusCode: 429,
});
```

## Common Patterns

### API Endpoints

```typescript
rateLimiter: {
  keyOptions: { limit: 100 },
  storageOptions: { windowMs: 60 * 1000 }, // 100 requests per minute
}
```

### Authentication Endpoints

```typescript
rateLimiter: {
  keyOptions: { limit: 5 },
  storageOptions: { windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
}
```

### Public Endpoints

```typescript
rateLimiter: {
  keyOptions: { limit: 1000 },
  storageOptions: { windowMs: 60 * 1000 }, // 1000 requests per minute
}
```

### Sensitive Operations

```typescript
rateLimiter: {
  keyOptions: { limit: 10 },
  storageOptions: { windowMs: 60 * 60 * 1000 }, // 10 requests per hour
}
```

## Complete Example

```typescript
const server = new Server({
  plugins: {
    rateLimiter: {
      keyOptions: { limit: 100 },
      storageOptions: { windowMs: 60_000 },
    },
  },
});

@controller("/api")
export class ApiController {
  // Global rate limit applies here
  @get("/users")
  async getUsers(req: Request, res: Response) {
    res.json(await getUsers());
  }

  // Custom rate limit for auth endpoint
  @post("/auth/login", {
    middleware: [rateLimiter({ limit: 5 }, { windowMs: 15 * 60 * 1000 })],
  })
  async login(req: Request, res: Response) {
    const user = await authenticateUser(req.body);
    res.json(user);
  }

  // Custom rate limit by API key
  @get("/premium", {
    middleware: [
      rateLimiter(
        {
          type: "custom",
          key: (req) => req.rawHeaders.get("X-API-Key") ?? req.ip,
          limit: 1000,
        },
        { windowMs: 60_000 },
      ),
    ],
  })
  async premiumEndpoint(req: Request, res: Response) {
    res.json({ data: "premium content" });
  }
}
```

## Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    rateLimiter: isProduction
      ? {
          keyOptions: { limit: 100 },
          storageOptions: { windowMs: 60_000 },
        }
      : undefined, // Disable in development
  },
});
```

## Custom Storage

For distributed systems, pass an atomic `increment` as the second argument. It must create a new
fixed window on the first call and return the current count plus the window's reset timestamp:

```typescript
rateLimiter(
  { type: "ip", limit: 100 },
  {
    type: "custom",
    windowMs: 60000,
    increment: async (key, windowMs) => {
      // Atomically increment in Redis, DynamoDB, etc.
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      const ttl = await redis.pttl(key);
      return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
    },
  },
);
```

A ready-made Redis implementation ships with balda — it uses the built-in `Bun.RedisClient` on Bun
and dynamically imports `ioredis` on Node and Deno:

```typescript
import { rateLimiter, redisRateLimitStorage } from "balda";

server.use(
  rateLimiter(
    { type: "ip", limit: 100 },
    redisRateLimitStorage({ url: process.env.REDIS_URL, keyPrefix: "rl:" }),
  ),
);
```

When custom storage throws, the limiter **fails closed** by default (returns the 429 response) since
a custom store is a shared external dependency. Pass `failClosed: false` to fail open instead, and
use `onStorageError(error, key, windowMs)` to observe outages:

```typescript
rateLimiter({
  type: "ip",
  failClosed: false,
  onStorageError: (err, key, windowMs) =>
    logger.error({ err, key, windowMs }, "rate limit store down"),
});
```

## Best Practices

1. **Use different limits for different endpoints** - Auth endpoints need stricter limits
2. **Consider user tier** - Premium users might get higher limits
3. **Monitor rate limit hits** - Adjust limits based on actual usage
4. **Use distributed storage** - In-memory storage doesn't work across multiple servers
5. **Provide clear error messages** - Help users understand why they're being limited
6. **Watch storage failures** - `onStorageError` turns a silent outage into a log line
