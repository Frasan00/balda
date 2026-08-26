---
title: Log Plugin
description: Request and response logging with configurable detail levels. Integrate with Pino for structured output.
keywords: [balda, log, logging, request, response, pino]
sidebar_position: 8
---

# Log Plugin

Provides comprehensive request and response logging for your application. Automatically logs HTTP requests and responses with configurable detail levels.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    log: {
      logRequest: true,
      logResponse: true,
    },
  },
});
```

## Configuration

### Basic Configuration

```typescript
log: {
  logRequest: true,           // Enable request logging
  logResponse: true           // Enable response logging
}
```

### Detailed Configuration

```typescript
log: {
  logRequest: true,
  logResponse: true,
  requestPayload: {
    method: true,             // Log HTTP method
    url: true,                // Log request URL
    ip: true,                 // Log client IP
    headers: true,            // Log request headers
    body: false               // Log request body (default: false)
  },
  responsePayload: {
    status: true,             // Log response status
    headers: false,           // Log response headers (default: false)
    body: false               // Log response body (default: false)
  }
}
```

## Usage

### Global Logging

```typescript
const server = new Server({
  plugins: {
    log: {
      logRequest: true,
      logResponse: true,
      requestPayload: {
        method: true,
        url: true,
        ip: true,
        headers: false, // Disable for privacy
        body: false,
      },
      responsePayload: {
        status: true,
        headers: false,
        body: false,
      },
    },
  },
});
```

### Route-Level Logging

```typescript
import { log } from "balda";

@controller("/api")
export class ApiController {
  @get("/users", {
    middleware: [
      log({
        logRequest: true,
        logResponse: true,
      }),
    ],
  })
  async getUsers(req: Request, res: Response) {
    res.json(await getUsers());
  }

  // Disable logging for health checks
  @get("/health", {
    middleware: [
      log({
        logRequest: false,
        logResponse: false,
      }),
    ],
  })
  async health(req: Request, res: Response) {
    res.json({ status: "ok" });
  }
}
```

## Log Output

### Request Log

```json
{
  "level": 30,
  "time": 1234567890,
  "type": "request",
  "requestId": "abc123",
  "method": "GET",
  "url": "/api/users",
  "headers": {}
}
```

### Response Log

```json
{
  "level": 30,
  "time": 1234567891,
  "type": "response",
  "requestId": "abc123",
  "status": 200
}
```

## Configuration Options

### requestPayload Options

| Option    | Type    | Default | Description         |
| --------- | ------- | ------- | ------------------- |
| `method`  | boolean | `true`  | Log HTTP method     |
| `url`     | boolean | `true`  | Log request URL     |
| `ip`      | boolean | `true`  | Log client IP       |
| `headers` | boolean | `true`  | Log request headers |
| `body`    | boolean | `false` | Log request body    |

### responsePayload Options

| Option    | Type    | Default | Description          |
| --------- | ------- | ------- | -------------------- |
| `status`  | boolean | `true`  | Log response status  |
| `headers` | boolean | `false` | Log response headers |
| `body`    | boolean | `false` | Log response body    |

## Common Patterns

### Production Logging

```typescript
log: {
  logRequest: true,
  logResponse: true,
  requestPayload: {
    method: true,
    url: true,
    ip: true,
    headers: false,      // Don't log sensitive headers
    body: false          // Don't log request bodies
  },
  responsePayload: {
    status: true,
    headers: false,
    body: false
  }
}
```

### Development Logging

```typescript
log: {
  logRequest: true,
  logResponse: true,
  requestPayload: {
    method: true,
    url: true,
    ip: true,
    headers: true,
    body: true           // Log everything in development
  },
  responsePayload: {
    status: true,
    headers: true,
    body: true
  }
}
```

### API Monitoring

```typescript
log: {
  logRequest: true,
  logResponse: true,
  requestPayload: {
    method: true,
    url: true,
    ip: true,
    headers: false,
    body: false
  },
  responsePayload: {
    status: true,         // Track status codes
    headers: false,
    body: false
  }
}
```

### Minimal Logging

```typescript
log: {
  logRequest: true,
  logResponse: false,
  requestPayload: {
    method: true,
    url: true,
    ip: false,
    headers: false,
    body: false
  }
}
```

## Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    log: {
      logRequest: true,
      logResponse: true,
      requestPayload: {
        method: true,
        url: true,
        ip: true,
        headers: !isProduction, // Only in development
        body: !isProduction, // Only in development
      },
      responsePayload: {
        status: true,
        headers: !isProduction,
        body: !isProduction,
      },
    },
  },
});
```

## Complete Example

```typescript
const server = new Server({
  port: 3000,
  plugins: {
    log: {
      logRequest: true,
      logResponse: true,
      requestPayload: {
        method: true,
        url: true,
        ip: true,
        headers: false,
        body: false,
      },
      responsePayload: {
        status: true,
        headers: false,
        body: false,
      },
    },
  },
});

@controller("/api")
export class ApiController {
  @get("/users")
  async getUsers(req: Request, res: Response) {
    // Logs: GET /api/users → 200
    const users = await getUsers();
    res.json(users);
  }

  @get("/health", {
    middleware: [log({ logRequest: false, logResponse: false })],
  })
  async health(req: Request, res: Response) {
    // No logging for health checks
    res.json({ status: "ok" });
  }
}
```

## Disabling Logging

```typescript
const server = new Server({
  plugins: {
    log: {
      logRequest: false,
      logResponse: false,
    },
  },
});
```

## Best Practices

1. **Don't log sensitive data** - Disable headers/body logging in production
2. **Exclude health checks** - Use route-level logging to exclude health endpoints
3. **Monitor performance** - Track response times and status codes
4. **Use structured logging** - JSON format makes logs easy to parse
5. **Configure by environment** - More verbose in development, minimal in production
