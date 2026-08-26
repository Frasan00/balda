---
title: Configuration
description: Configure your Balda server with port, host, plugins, swagger, and environment variables. Development and production setup examples.
keywords:
  [balda, configuration, server options, environment variables, setup, plugins]
sidebar_position: 3
---

# Configuration

Configure your Balda server with options and plugins.

## Basic Configuration

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  host: "localhost",
  controllerPatterns: ["./src/controllers/**/*.ts"],
  plugins: {
    cors: { origin: "*" },
    bodyParser: { json: { sizeLimit: "1mb" } },
  },
  swagger: true,
});
```

## Configuration Options

| Option               | Type              | Default   | Description                                            |
| -------------------- | ----------------- | --------- | ------------------------------------------------------ |
| `port`               | number            | 80        | Port to listen on                                      |
| `host`               | string            | "0.0.0.0" | Host address                                           |
| `controllerPatterns` | string[]          | []        | Glob patterns for controller files                     |
| `plugins`            | object            | {}        | Plugin configurations                                  |
| `swagger`            | boolean \| object | true      | Enable/configure Swagger docs                          |
| `tapOptions`         | object            | {}        | Runtime-specific server options, see [WebSockets](../websockets/overview) |
| `nodeHttpClient`     | string            | "http"    | Node.js HTTP module (http, https, http2, http2-secure) |
| `httpsOptions`       | object            | -         | TLS options for HTTPS/HTTP2 (Node.js only)             |

## Environment Variables

Use environment variables for configuration:

```typescript
const server = new Server({
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "localhost",
  plugins: {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
  },
});
```

## Common Configurations

### Development

```typescript
const server = new Server({
  port: 3000,
  host: "localhost",
  plugins: {
    cors: { origin: "*" },
    log: { logRequest: true, logResponse: true },
  },
  swagger: true,
});
```

### Production

```typescript
const server = new Server({
  port: Number(process.env.PORT),
  host: "0.0.0.0",
  plugins: {
    cors: { origin: process.env.ALLOWED_ORIGINS.split(",") },
    helmet: {},
    rateLimiter: { windowMs: 15 * 60 * 1000, max: 100 },
    compression: {},
  },
  swagger: false,
});
```

## Learn More

- [Server API Reference](../core-concepts/server) - Complete server configuration options
- [Plugins Overview](../plugins/overview) - Available plugins and their configurations
- [Development Guide](./development) - Hot reload and development setup
