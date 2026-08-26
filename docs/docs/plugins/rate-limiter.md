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
      keyOptions: {
        limit: 100,
        windowMs: 60000, // 1 minute
      },
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
    limit: 100,                     // Requests per window
    windowMs: 60000                 // Time window in ms (1 minute)
  }
}
```

### Custom Key-Based Limiting

```typescript
rateLimiter: {
  keyOptions: {
    key: (req) => {
      // Use API key or user ID as rate limit key
      return req.rawHeaders.get('X-API-Key') || req.ip;
    },
    limit: 50,
    windowMs: 60000
  }
}
```

### Storage Configuration

```typescript
rateLimiter: {
  keyOptions: {
    limit: 100,
    windowMs: 60000,
    storageStrategy: "memory"  // Default: in-memory storage
  }
}
```

## Usage

### Global Rate Limiting

```typescript
const server = new Server({
  plugins: {
    rateLimiter: {
      keyOptions: {
        limit: 100,
        windowMs: 60000, // 100 requests per minute
      },
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
    middleware: [
      rateLimiter({
        keyOptions: {
          limit: 1000,
          windowMs: 60000,
        },
      }),
    ],
  })
  async publicEndpoint(req: Request, res: Response) {
    // 1000 requests per minute
    res.json({ message: "Public endpoint" });
  }

  @post("/auth/login", {
    middleware: [
      rateLimiter({
        keyOptions: {
          limit: 5,
          windowMs: 15 * 60 * 1000, // 15 minutes
        },
      }),
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
    key: (req) => {
      // Rate limit by user ID if authenticated, IP otherwise
      const userId = req.user?.id;
      return userId || req.ip;
    },
    limit: 100,
    windowMs: 60000
  }
}
```

## Error Response

When rate limit is exceeded:

```json
// Response: 429 Too Many Requests
{
  "error": "Too many requests. Please try again later."
}
```

## Common Patterns

### API Endpoints

```typescript
rateLimiter: {
  keyOptions: {
    limit: 100,
    windowMs: 60 * 1000  // 100 requests per minute
  }
}
```

### Authentication Endpoints

```typescript
rateLimiter: {
  keyOptions: {
    limit: 5,
    windowMs: 15 * 60 * 1000  // 5 attempts per 15 minutes
  }
}
```

### Public Endpoints

```typescript
rateLimiter: {
  keyOptions: {
    limit: 1000,
    windowMs: 60 * 1000  // 1000 requests per minute
  }
}
```

### Sensitive Operations

```typescript
rateLimiter: {
  keyOptions: {
    limit: 10,
    windowMs: 60 * 60 * 1000  // 10 requests per hour
  }
}
```

## Complete Example

```typescript
const server = new Server({
  plugins: {
    rateLimiter: {
      keyOptions: {
        limit: 100,
        windowMs: 60000,
      },
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
    middleware: [
      rateLimiter({
        keyOptions: {
          limit: 5,
          windowMs: 15 * 60 * 1000,
        },
      }),
    ],
  })
  async login(req: Request, res: Response) {
    const user = await authenticateUser(req.body);
    res.json(user);
  }

  // Custom rate limit by API key
  @get("/premium", {
    middleware: [
      rateLimiter({
        keyOptions: {
          key: (req) => req.rawHeaders.get("X-API-Key") || req.ip,
          limit: 1000,
          windowMs: 60000,
        },
      }),
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
          keyOptions: {
            limit: 100,
            windowMs: 60000,
          },
        }
      : undefined, // Disable in development
  },
});
```

## Custom Storage

For distributed systems, implement custom storage:

```typescript
rateLimiter: {
  keyOptions: {
    limit: 100,
    windowMs: 60000,
    storageStrategy: "custom",
    get: async (key) => {
      // Get from Redis, DynamoDB, etc.
      return await redis.get(key);
    },
    set: async (key, value) => {
      // Store in Redis, DynamoDB, etc.
      await redis.set(key, value);
    }
  }
}
```

## Best Practices

1. **Use different limits for different endpoints** - Auth endpoints need stricter limits
2. **Consider user tier** - Premium users might get higher limits
3. **Monitor rate limit hits** - Adjust limits based on actual usage
4. **Use distributed storage** - In-memory storage doesn't work across multiple servers
5. **Provide clear error messages** - Help users understand why they're being limited
