---
title: CORS Plugin
description: Enable Cross-Origin Resource Sharing for API access from browsers. Configure origins, methods, headers, and credentials.
keywords: [balda, cors, cross-origin, security, headers, preflight]
sidebar_position: 2
---

# CORS Plugin

Enables Cross-Origin Resource Sharing (CORS) in your application. Handles preflight requests and sets appropriate CORS headers for both simple and complex requests.

When you only configure `origin`, Balda keeps its default CORS headers in place. That means preflight responses still send `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE`, and `Access-Control-Allow-Headers` will echo the incoming `Access-Control-Request-Headers` unless you explicitly override `allowedHeaders`.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    cors: {
      origin: ["http://localhost:3000"],
    },
  },
});
```

With the configuration above, Balda still applies the default allowed methods and will automatically mirror requested preflight headers.

## Configuration

### origin

Configure allowed origins:

```typescript
// Allow all origins (development only)
cors: {
  origin: "*";
}

// Allow specific origins
cors: {
  origin: ["https://myapp.com", "https://admin.myapp.com"];
}

// Allow origins with regex
cors: {
  origin: ["https://myapp.com", /^https:\/\/.*\.myapp\.com$/];
}

```

### methods

Configure allowed HTTP methods:

```typescript
// Default
cors: {
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];
}

// Custom
cors: {
  methods: ["GET", "POST", "PUT", "DELETE"];
}

// String format
cors: {
  methods: "GET,POST,PUT,DELETE";
}
```

### allowedHeaders

Configure allowed request headers:

If you omit `allowedHeaders`, Balda uses the browser's requested preflight headers by echoing `Access-Control-Request-Headers`.

```typescript
// Default: echo requested preflight headers
cors: {
  origin: ["https://myapp.com"];
}

// Specific headers
cors: {
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"];
}

// Allow all
cors: {
  allowedHeaders: "*";
}
```

### exposedHeaders

Expose response headers to the client:

```typescript
cors: {
  exposedHeaders: ["X-Total-Count", "X-Page-Count"];
}
```

### credentials

Enable credentials (cookies, authorization headers):

```typescript
cors: {
  origin: ['https://myapp.com'],  // Required with credentials
  credentials: true
}
```

### maxAge

Cache preflight results (in seconds):

```typescript
cors: {
  maxAge: 86400; // 24 hours
}
```

### Complete Configuration

```typescript
const server = new Server({
  plugins: {
    cors: {
      origin: ["https://myapp.com"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["X-Total-Count"],
      credentials: true,
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    },
  },
});
```

## Route-Level CORS

Apply CORS to specific routes:

```typescript
import { cors } from "balda";

@controller("/api")
export class ApiController {
  @get("/public", {
    middleware: [cors({ origin: "*" })],
  })
  async publicEndpoint(req: Request, res: Response) {
    res.json({ message: "Public endpoint" });
  }

  @get("/private", {
    middleware: [
      cors({
        origin: ["https://myapp.com"],
        credentials: true,
      }),
    ],
  })
  async privateEndpoint(req: Request, res: Response) {
    res.json({ message: "Private endpoint" });
  }
}
```

## Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    cors: {
      origin: isProduction
        ? process.env.ALLOWED_ORIGINS?.split(",")
        : ["http://localhost:3000"],
      credentials: isProduction,
      maxAge: isProduction ? 86400 : undefined,
    },
  },
});
```

## Security Considerations

### ❌ Wildcard with Credentials

This doesn't work - credentials require specific origins:

```typescript
cors: {
  origin: '*',
  credentials: true  // Error!
}
```

### ✅ Specific Origins with Credentials

```typescript
cors: {
  origin: ['https://myapp.com', 'https://admin.myapp.com'],
  credentials: true  // Works!
}
```

### Production Configuration

```typescript
cors: {
  origin: ['https://myapp.com'],  // Specific origins only
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}
```

## CORS Headers

### Request Headers (from browser)

- `Origin` - The origin of the request
- `Access-Control-Request-Method` - HTTP method for actual request
- `Access-Control-Request-Headers` - Headers for actual request

### Response Headers (from server)

- `Access-Control-Allow-Origin` - Allowed origins
- `Access-Control-Allow-Methods` - Allowed HTTP methods
- `Access-Control-Allow-Headers` - Allowed headers
- `Access-Control-Expose-Headers` - Headers exposed to client
- `Access-Control-Allow-Credentials` - Whether credentials allowed
- `Access-Control-Max-Age` - Preflight cache duration

## Preflight Requests

CORS automatically handles preflight OPTIONS requests:

```http
OPTIONS /api/users
Origin: https://myapp.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization

→ Response:
Access-Control-Allow-Origin: https://myapp.com
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```
