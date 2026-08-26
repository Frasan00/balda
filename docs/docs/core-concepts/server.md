---
title: Server Configuration
description: Create and configure Balda server instances with plugins, middleware, and runtime options for Node.js, Bun, and Deno.
keywords: [balda, server, configuration, port, host, plugins, lifecycle]
sidebar_position: 1
---

# Server

The `Server` class is the main entry point for creating Balda applications. It handles HTTP requests, manages middleware, and orchestrates the entire application lifecycle.

## Creating a Server

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  host: "localhost",
});
```

## Server Lifecycle

### 1. Initialization

When you create a server instance, it:

- Sets up the runtime connector (Node.js, Bun, or Deno)
- Initializes the router
- Applies global middleware
- Sets up the body parser

```typescript
const server = new Server({
  port: 3000,
  plugins: {
    cors: { origin: "*" },
    bodyParser: { json: { sizeLimit: "1mb" } },
  },
});
```

### 2. Route Registration

Routes can be registered in two ways:

**Direct registration:**

```typescript
server.router.get("/users", (req, res) => {
  res.json({ users: [] });
});
```

**Controller-based registration:**

```typescript
@controller("/users")
export class UsersController {
  @get("/")
  async getUsers(req, res) {
    res.json({ users: [] });
  }
}
```

**Using the global router:**

For library-level or modular route definitions, you can import the shared `router` and register routes without a `Server` instance. These routes will be consumed by the server at startup.

```typescript
import { router } from "balda";

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post("/login", authMiddleware, (req, res) => {
  res.json({ token: "..." });
});

router.get("/admin", [authMiddleware, adminMiddleware], (req, res) => {
  res.json({ ok: true });
});
```

### 3. Server Startup

When you call `server.listen()`, the server:

- Imports controllers based on patterns
- Registers all routes
- Applies plugins
- Runs `beforeStart` hooks in order
- Starts listening for requests

```typescript
server.listen(({ port, host }) => {
  console.log(`Server running on http://${host}:${port}`);
});

// optional you can specify the port directly in listen
server.listen((3000, { port, host }) => {
  console.log(`Server running on http://${host}:${port}`);
});
```

### Lifecycle Hooks

#### `beforeStart`

Register hooks that run after bootstrap (controllers imported, plugins applied) but before the server starts accepting requests. This is useful for connecting to databases, warming caches, or performing other async setup.

```typescript
server.beforeStart(async () => {
  await connectToDatabase();
});

server.beforeStart(async () => {
  await warmUpCache();
});

server.listen(({ port }) => {
  console.log(`Server running on port ${port}`);
});
```

Multiple hooks are called sequentially in the order they are registered. If any hook throws, the server will not start and the error is passed to the `listen` callback.

#### `beforeClose`

Register hooks that run before the server stops accepting requests and before any connection is closed. This is the place to close resources that need a graceful goodbye — for example, notifying connected WebSocket clients before the transport goes down (see [WebSockets: Shutting down](../websockets/overview#shutting-down)).

```typescript
server.beforeClose(async () => {
  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }
});

await server.close();
```

Multiple hooks run sequentially in registration order. If a hook throws, the remaining hooks still run, the server still closes, and the error is rethrown from `close()`/`disconnect()` after the close completes.

## Server Configuration

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  host: "localhost",
  controllerPatterns: ["./src/controllers/**/*.ts"],
  plugins: {
    cors: { origin: "*" },
    bodyParser: { json: { sizeLimit: "10mb" } },
  },
  swagger: true,
});
```

:::tip
See the [Configuration Guide](../getting-started/configuration) for detailed options and [Plugins Overview](../plugins/overview) for available plugins.
:::

## Server Methods

### HTTP Methods

```typescript
// Basic routes using server instance
server.router.get("/users", (req, res) => res.json({ users: [] }));
server.router.post("/users", (req, res) => res.created(req.body));
server.router.put("/users/:id", (req, res) => res.json({ id: req.params.id }));
server.router.patch("/users/:id", (req, res) => res.json(req.body));
server.router.delete("/users/:id", (req, res) => res.noContent());

// Basic routes using global router
router.get("/users", (req, res) => res.json({ users: [] }));
router.post("/users", (req, res) => res.created(req.body));
router.put("/users/:id", (req, res) => res.json({ id: req.params.id }));
router.patch("/users/:id", (req, res) => res.json(req.body));
router.delete("/users/:id", (req, res) => res.noContent());

// With middleware
server.router.post("/users", authMiddleware, (req, res) =>
  res.created(req.body),
);
router.put("/users/:id", [authMiddleware, auditMiddleware], (req, res) => {
  res.json({ id: req.params.id });
});
```

### Middleware Management

```typescript
// Single middleware
server.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Multiple middleware
server.use(authMiddleware, loggingMiddleware);
```

### Path Normalization and Groups

Paths are normalized to avoid duplicate or trailing slashes. Grouping allows composing a base path and shared middleware:

```typescript
server.router.group("/api", (r) => {
  r.get("/status", (req, res) => res.json({ ok: true })); // => /api/status
});

server.router.group("/v1", authMiddleware, (r) => {
  r.get("/me", (req, res) => res.json({ me: "..." })); // => /v1/me with auth
});

server.router.group("/admin", [authMiddleware, adminMiddleware], (r) => {
  r.get("/dashboard", (req, res) => res.json({ ok: true })); // => /admin/dashboard with both
});
```

The router supports the following overloads:

- handler-only: `get(path, handler)`
- with options: `get(path, options, handler)`

### Error Handling

```typescript
server.setErrorHandler((req, res, next, error) => {
  console.error("Error:", error);

  if (error.name === "ValidationError") {
    return res.badRequest({ error: error.message });
  }

  res.internalServerError({ error: "Internal server error" });
});
```

### Custom Not Found Handler

By default, Balda returns a standardized 404 error response when a route is not found. You can customize this behavior using `setNotFoundHandler`:

```typescript
server.setNotFoundHandler((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `The route ${req.url} does not exist`,
    timestamp: new Date().toISOString(),
  });
});
```

**Advanced Examples:**

**HTML Response for Web Applications:**

```typescript
server.setNotFoundHandler((req, res) => {
  res.status(404).html(`
    <!DOCTYPE html>
    <html>
      <head><title>404 - Page Not Found</title></head>
      <body>
        <h1>Oops! Page not found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go back home</a>
      </body>
    </html>
  `);
});
```

**Resetting to Default Behavior:**

To reset to the default not found handler, pass `undefined`:

```typescript
server.setNotFoundHandler(undefined);
```

## Server Properties

### Read-only Properties

```typescript
// Get server URL
console.log(server.url); // http://localhost:3000

// Get server port
console.log(server.port); // 3000

// Get server host
console.log(server.host); // localhost

// Check if server is listening
console.log(server.isListening); // true/false
```

### Utility Methods

```typescript
import type { NodeHttpClient } from "balda";

declare module "balda" {
  interface Server {
    db: typeof db;
  }
}

// Get temporary directory
const tmpDir = server.tmpDir("uploads", "images");

// Embed data for later use
server.embed("config", { apiKey: "secret" });

// Get embedded data
const config = server.embed("config");

// Exit the server
server.exit(0);
```

## Event Handling

```typescript
// Handle graceful shutdown
server.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  server.close();
});

server.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  server.close();
});
```

## Server Shutdown

```typescript
// Graceful shutdown
async function shutdown() {
  console.log("Shutting down server...");
  await server.close();
  console.log("Server shut down successfully");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

`close()` (alias `disconnect()`) always settles within roughly `timeoutMs` (10 seconds by
default) — any open connections are given that long to drain before being forced closed, so
shutdown is never left hanging indefinitely:

```typescript
// Wait up to 30s for connections to drain before forcing them closed
await server.close({ timeoutMs: 30_000 });

// Force-close immediately, don't wait at all
await server.close({ timeoutMs: 0 });
```

A second `close()` call while one is already in flight just awaits the same shutdown instead
of starting a new one. See [WebSockets: Shutting down](../websockets/overview#shutting-down)
for how this interacts with open WebSocket connections on each runtime.

## Runtime Support

Balda automatically detects and adapts to your runtime:

### Node.js

```typescript
// Uses Node.js http module
const server = new Server({
  port: 3000,
});
```

### Bun

```typescript
// Uses Bun's HTTP server
const server = new Server({
  port: 3000,
});
```

### Deno

```typescript
// Uses Deno's HTTP server
const server = new Server({
  port: 3000,
});
```

### Beyond Node, Bun, and Deno

`server.listen()` covers any host that runs one of those three runtimes - which is most
container platforms (Cloud Run, Fly, Railway, Render, App Runner, a plain VM). For platforms
that hand you a `Request` instead of letting you bind a port, use `server.fetch()`:

```typescript
// Deno Deploy / Supabase Edge Functions
Deno.serve(server.fetch);

// Vercel / Netlify functions
export default server.fetch;
```

AWS Lambda has its own native `handle()` adapter. See [Deployment](../deployment/overview) for
the full support table and details.

## Node.js HTTP Client Options

When running on Node.js, you can specify which HTTP module to use via the `nodeHttpClient` option:

```typescript
const server = new Server({
  port: 3000,
  nodeHttpClient: "http", // 'http' | 'http2' | 'https' | 'http2-secure'
});
```

### Available Options

| Value            | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `'http'`         | Standard HTTP/1.1 server (default)                                    |
| `'http2'`        | HTTP/2 server without TLS (cleartext, h2c)                            |
| `'https'`        | HTTPS server with TLS encryption (HTTP/1.1 over TLS)                  |
| `'http2-secure'` | HTTP/2 server with TLS encryption (recommended for production HTTP/2) |

### HTTPS Configuration

When using `nodeHttpClient: 'https'`, you **must** provide the `httpsOptions` with your TLS certificate and key:

```typescript
import fs from "fs";

const server = new Server({
  port: 443,
  nodeHttpClient: "https",
  httpsOptions: {
    key: fs.readFileSync("./certs/private-key.pem"),
    cert: fs.readFileSync("./certs/certificate.pem"),
  },
});

server.listen(({ url }) => {
  console.log(`🔒 Secure server running at ${url}`);
});
```

### HTTP/2 Secure Configuration

For HTTP/2 with TLS (the standard way browsers connect via HTTP/2), use `nodeHttpClient: 'http2-secure'`:

```typescript
import fs from "fs";

const server = new Server({
  port: 443,
  nodeHttpClient: "http2-secure",
  httpsOptions: {
    key: fs.readFileSync("./certs/private-key.pem"),
    cert: fs.readFileSync("./certs/certificate.pem"),
  },
});

server.listen(({ url }) => {
  console.log(`🚀 HTTP/2 secure server running at ${url}`);
});
```

:::info
Most browsers only support HTTP/2 over TLS, so `'http2-secure'` is the recommended option for production HTTP/2 servers. The `'http2'` option (cleartext h2c) is primarily useful for internal services or testing.
:::

### TLS Options

Both `'https'` and `'http2-secure'` require `httpsOptions`. You can pass any valid [Node.js TLS options](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener):

```typescript
const server = new Server({
  port: 443,
  nodeHttpClient: "http2-secure",
  httpsOptions: {
    key: fs.readFileSync("./certs/private-key.pem"),
    cert: fs.readFileSync("./certs/certificate.pem"),
    ca: fs.readFileSync("./certs/ca-certificate.pem"), // Certificate Authority
    passphrase: "your-passphrase", // If key is encrypted
    minVersion: "TLSv1.2", // Minimum TLS version
  },
});
```

:::tip
For local development, you can generate self-signed certificates using tools like [mkcert](https://github.com/FiloSottile/mkcert).
:::

:::note
The `httpsOptions` property is **only available** when `nodeHttpClient` is set to `'https'` or `'http2-secure'`. TypeScript will enforce this at compile time.
:::

## Complete Example

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  controllerPatterns: ["./src/controllers/**/*.ts"],
  plugins: {
    cors: { origin: "*" },
    bodyParser: { json: { sizeLimit: "10mb" } },
  },
});

// Global middleware
server.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Error handling
server.setErrorHandler((req, res, next, error) => {
  res.internalServerError({ error: error.message });
});

// Health check
server.router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
server.listen(({ port }) => {
  console.log(`Server running on http://localhost:${port}`);
});
```
