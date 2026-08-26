---
title: Plugins Overview
description: Balda's plugin system extends functionality with middleware for CORS, body parsing, security, compression, and more. Create custom plugins.
keywords: [balda, plugins, overview, middleware, extension, body parser, cors]
sidebar_position: 1
---

# Plugins Overview

Balda provides a comprehensive plugin system that allows you to extend the framework's functionality with additional features and middleware. All plugins are included in the framework as a standard library - you can use them directly or as a reference to create your own plugins.

## What are Plugins?

Plugins in Balda are modular components that add specific functionality to your application. They provide middleware for request/response processing, body parsing, security, documentation, and utilities.

## Built-in Plugins

### Body Parser

- **[Body Parser](./body-parser)** - Unified middleware for parsing request bodies

Balda includes a unified body parser middleware that automatically handles multiple content types:

- **JSON** (`application/json`) - Parse JSON request bodies
- **URL Encoded** (`application/x-www-form-urlencoded`) - Parse HTML form submissions
- **File Uploads** (`multipart/form-data`) - Handle file uploads

All three formats are handled by a single body parser middleware that automatically detects the content type and applies the appropriate parsing strategy. Configure each format independently through the plugins configuration.

### Security

- **[CORS](./cors)** - Cross-Origin Resource Sharing configuration
- **[Helmet](./helmet)** - Security headers (CSP, XSS protection, etc.)
- **[Rate Limiter](./rate-limiter)** - Request rate limiting per IP/key
- **[Trust Proxy](./trust-proxy)** - Safe client IP resolution behind reverse proxies

### Utilities

- **[Compression](./compression)** - Gzip compression for response bodies
- **[Method Override](./method-override)** - HTTP verb support via headers
- **[Static](./static)** - Serve static files (images, CSS, JavaScript)
- **[Cookie](./cookie)** - Parse and manage cookies
- **[Log](./log)** - Request/response logging

### Documentation

- **[Swagger](./swagger)** - OpenAPI/Swagger documentation generator

### Advanced (Internal Use)

The following plugins are available for advanced use cases but are typically used internally by the framework:

- **Session** - Session management with customizable stores
- **Timeout** - Request timeout handling

## Quick Start

Configure plugins through the server options:

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  plugins: {
    cors: { origin: ["http://localhost:3000"], credentials: true },
    bodyParser: { sizeLimit: "10mb" },
    compression: { threshold: 1024, level: 6 },
    methodOverride: { methods: ["POST"] },
    static: { source: "./public", path: "/public" },
    // Behind a reverse proxy in production:
    // trustProxy: { trustedProxies: ["10.0.0.1"] },
  },
});
```

## Using Middlewares as Plugins

You can also pass an array of middlewares directly to the `plugins` option instead of the object form:

```typescript
import { Server } from "balda";
import { authMiddleware, loggingMiddleware } from "./middlewares";

const server = new Server({
  plugins: [authMiddleware, loggingMiddleware],
});
```

This is equivalent to calling `server.use()` for each middleware before the server starts listening.

## Configuration Patterns

### Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    cors: {
      origin: isProduction ? ["https://myapp.com"] : ["http://localhost:3000"],
    },
    helmet: isProduction ? {} : undefined,
    rateLimiter: isProduction
      ? {
          keyOptions: { limit: 100, windowMs: 15 * 60 * 1000 },
        }
      : undefined,
  },
});
```

### Route-Level Plugins

Apply plugins to specific routes using middleware:

````typescript
import { cors, json } from 'balda';

@controller('/api')
export class ApiController {
  @get('/public', {
    middleware: [cors({ origin: '*' })]
  })
  async publicEndpoint(req: Request, res: Response) {
    res.json({ message: 'Public endpoint' });
  }
}

## Creating Custom Plugins

Extend `BasePlugin` and implement the `handle()` method:

```typescript
import { BasePlugin, type ServerRouteMiddleware } from 'balda';

interface CustomPluginOptions {
  message?: string;
  enabled?: boolean;
}

export class CustomPlugin extends BasePlugin {
  private options: CustomPluginOptions;

  constructor(options: CustomPluginOptions = {}) {
    super();
    this.options = { message: 'Hello', enabled: true, ...options };
  }

  async handle(): Promise<ServerRouteMiddleware> {
    return async (req, res, next) => {
      if (this.options.enabled) {
        console.log(this.options.message);
      }
      await next();
    };
  }
}

// Usage
const server = new Server();
server.use(await new CustomPlugin({ message: 'Custom' }).handle());
````

## Best Practices

### 1. Environment-Based Configuration

Use environment variables to configure plugins differently for development and production:

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    cors: {
      origin: isProduction
        ? process.env.ALLOWED_ORIGINS?.split(",")
        : ["http://localhost:3000"],
    },
    helmet: isProduction ? {} : undefined,
    rateLimiter: isProduction
      ? {
          keyOptions: { limit: 100, windowMs: 15 * 60 * 1000 },
        }
      : undefined,
  },
});
```

### 2. Set Appropriate Limits

Configure size limits based on your application needs:

```typescript
plugins: {
  json: { sizeLimit: "10mb" },        // API payloads
  file: { maxFileSize: "50mb" }       // File uploads
}
```

### 3. Layer Security

Combine security plugins for defense in depth:

```typescript
plugins: {
  helmet: { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } },
  cors: { origin: ['https://myapp.com'], credentials: true },
  rateLimiter: { keyOptions: { limit: 100, windowMs: 15 * 60 * 1000 } }
}
```

### 4. Enable Logging

Use the log plugin to monitor requests:

```typescript
plugins: {
  log: {
    logResponse: true;
  }
}
```

## Runtime Compatibility

All built-in plugins work across all supported runtimes:

- **Node.js** - Full support
- **Bun** - Full support
- **Deno** - Full support

Plugins automatically detect the runtime and use the appropriate implementation. No additional configuration required.
