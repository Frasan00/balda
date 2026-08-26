---
title: WebSockets
description: Real-time bidirectional communication across Node.js, Bun, and Deno. Runtime-specific WebSocket configurations.
keywords: [balda, websockets, realtime, bidirectional, socket]
sidebar_position: 1
---

# WebSockets

WebSockets provide a full-duplex communication channel over a single TCP connection, enabling real-time bidirectional communication between clients and servers. Balda supports WebSockets across all three runtimes (Node.js, Bun, and Deno) with runtime-specific configurations.

## Overview

WebSocket support in Balda is:

- **Runtime-specific**: Each runtime (Node.js, Bun, Deno) has its own implementation
- **Opt-in**: WebSocket upgrade only happens when explicitly configured
- **Flexible**: Configure handlers for connection lifecycle events (open, message, close)

## When WebSocket Upgrade Happens

On Bun and Deno, WebSocket upgrade is triggered when **all** of these are true:

1. The client sends a request with the `Upgrade: websocket` header
2. WebSocket configuration is provided in the server's `tapOptions`
3. The runtime's `fetch`/`handler` tap hook, if configured, didn't return a `Response` and didn't upgrade the request itself

If WebSocket configuration is **not provided**, the server will handle all requests normally without attempting any WebSocket upgrades.

## Runtime-Specific Implementations

### Node.js

For Node.js, Balda doesn't provide built-in WebSocket handling. Instead, you can use the popular `ws` library to create a WebSocket server that attaches to the underlying HTTP server.

#### Installation

```bash
npm install ws
```

#### Usage

```typescript
import { Server } from "balda";
import { WebSocketServer } from "ws";

const server = new Server({
  port: 8080,
  host: "0.0.0.0",
  nodeHttpClient: "http",
});

// Get the underlying Node.js server
const nodeServer = server.getNodeServer();

// Create WebSocket server
const wss = new WebSocketServer({
  server: nodeServer,
  path: "/ws",
});

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.send("Hello from server");

  ws.on("message", (data) => {
    console.log("Received:", data.toString());
    ws.send(`Echo: ${data}`);
  });

  ws.on("close", () => {
    console.log("Connection closed");
  });
});

server.listen(({ url }) => {
  console.log(`Server listening on ${url}`);
});
```

#### Key Points

- Uses the standard `ws` library
- Requires getting the underlying Node server with `server.getNodeServer()`
- Full control over WebSocket path and configuration

#### Shutting down

Balda doesn't own your `ws` connections on Node, so it can't close them for you — `wss`
already tracks every connected client via `wss.clients`, so close them yourself in a
[`beforeClose`](../core-concepts/server#beforeclose) hook before calling `server.close()`:

```typescript
server.beforeClose(async () => {
  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }
});
```

Without this, `server.close()` still won't hang forever — it falls back to a generic
`timeoutMs` bound (10s by default, see [Server Shutdown](../core-concepts/server#server-shutdown))
— but the connection is only force-closed once that window elapses, and your clients get no
warning first. Closing them yourself in `beforeClose` is immediate and graceful.

---

### Bun

Bun has native WebSocket support built into `Bun.serve()`. Balda exposes this through the `tapOptions.bun.websocket` configuration.

#### Usage

```typescript
import { Server } from "balda";

const server = new Server({
  port: 8080,
  host: "0.0.0.0",
  tapOptions: {
    bun: {
      websocket: {
        open(ws) {
          console.log("WebSocket opened");
          ws.send("Welcome to Bun WebSocket!");
        },
        message(ws, message) {
          console.log("Received:", message);
          ws.send(`Echo: ${message}`);
        },
        close(ws, code, reason) {
          console.log(`Connection closed: ${code} - ${reason}`);
        },
        drain(ws) {
          console.log("Socket is ready to receive more data");
        },
      },
    },
  },
});

server.listen(({ url }) => {
  console.log(`Server listening on ${url}`);
});
```

#### WebSocket Handler Methods

- `open(ws: ServerWebSocket)`: Called when a WebSocket connection is established
- `message(ws: ServerWebSocket, message: string | Buffer)`: Called when a message is received
- `close(ws: ServerWebSocket, code: number, reason: string)`: Called when connection closes
- `drain(ws: ServerWebSocket)`: Called when the socket is ready to receive more data (backpressure)

#### How WebSocket Upgrade Works

When `tapOptions.bun.websocket` is configured:

1. If `tapOptions.bun.fetch` is also configured, it runs first
2. On incoming requests with `Upgrade: websocket` header, the server attempts upgrade
3. If upgrade succeeds, your handlers are called at appropriate lifecycle events
4. If no websocket config is provided, requests are handled normally (no upgrade attempted)

#### Rejecting an upgrade

Return a `Response` from `tapOptions.bun.fetch` to reject a specific request before it's
upgraded — the automatic upgrade above never runs for that request. Calling `server.upgrade()`
yourself inside the hook works too; balda detects it and won't attempt a second upgrade.

```typescript
tapOptions: {
  bun: {
    fetch(req, server) {
      if (req.rawHeaders.get("origin") !== "https://example.com") {
        return new Response("Origin not allowed", { status: 403 });
      }
      // falls through - the automatic upgrade above still applies
    },
    websocket: {
      /* ... */
    },
  },
},
```

#### Shutting down

Unlike Node, WebSocket connections here are entirely balda's own code path — `server.close()`
gives an open connection up to `timeoutMs` (10s by default) to close on its own, then force-closes
it. See [Server Shutdown](../core-concepts/server#server-shutdown) for the full `timeoutMs`
contract; there's nothing extra to configure on the WebSocket side.

---

### Deno

Deno also has native WebSocket support. Balda exposes this through the `tapOptions.deno.websocket` configuration.

#### Usage

```typescript
import { Server } from "balda";

const server = new Server({
  port: 8080,
  host: "0.0.0.0",
  tapOptions: {
    deno: {
      websocket: {
        open(ws) {
          console.log("WebSocket opened");
          ws.send("Welcome to Deno WebSocket!");
        },
        message(ws, message) {
          console.log("Received:", message);
          ws.send(`Echo: ${message}`);
        },
        close(ws) {
          console.log("Connection closed");
        },
      },
    },
  },
});

server.listen(({ url }) => {
  console.log(`Server listening on ${url}`);
});
```

#### WebSocket Handler Methods

- `open(ws: WebSocket)`: Called when a WebSocket connection is established
- `message(ws: WebSocket, message: string)`: Called when a message is received
- `close(ws: WebSocket)`: Called when connection closes

#### How WebSocket Upgrade Works

When `tapOptions.deno.websocket` is configured:

1. If `tapOptions.deno.handler` is also configured, it runs first
2. On incoming requests with `Upgrade: websocket` header, `Deno.upgradeWebSocket()` is called
3. Event handlers (onopen, onmessage, onclose) are attached to the WebSocket
4. The upgrade response is returned to the client
5. Your handlers are called at appropriate lifecycle events
6. If no websocket config is provided, requests are handled normally (no upgrade attempted)

#### Rejecting an upgrade

Return a `Response` from `tapOptions.deno.handler` to reject a specific request before it's
upgraded — the automatic upgrade above never runs for that request. You can also perform the
upgrade yourself with `Deno.upgradeWebSocket()` and return its `response`; balda won't attempt
a second one.

```typescript
tapOptions: {
  deno: {
    handler(req) {
      if (req.headers.get("origin") !== "https://example.com") {
        return new Response("Origin not allowed", { status: 403 });
      }
      // falls through - the automatic upgrade above still applies
    },
    websocket: {
      /* ... */
    },
  },
},
```

---

## Comparison Table

| Feature           | Node.js         | Bun                        | Deno                        |
| ----------------- | --------------- | -------------------------- | --------------------------- |
| **Library**       | `ws` (external) | Native                     | Native                      |
| **Configuration** | Direct API      | `tapOptions.bun.websocket` | `tapOptions.deno.websocket` |
| **Auto Upgrade**  | Manual setup    | Automatic when configured  | Automatic when configured   |
| **Path Control**  | Full control    | All upgrade requests, unless `tapOptions.bun.fetch` rejects one | All upgrade requests, unless `tapOptions.deno.handler` rejects one |
| **Type**          | `ws.WebSocket`  | `ServerWebSocket`          | `WebSocket`                 |

---

## Security Considerations

### 1. Validate Origin

```typescript
// Node.js - rejection happens after the handshake, the socket briefly opens first
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    ws.close(1008, "Origin not allowed");
    return;
  }
});
```

```typescript
// Bun / Deno - rejection happens before the handshake, via the tap hook
tapOptions: {
  bun: {
    fetch(req) {
      const origin = req.rawHeaders.get("origin");
      if (!isAllowedOrigin(origin)) {
        return new Response("Origin not allowed", { status: 403 });
      }
    },
    websocket: {
      /* ... */
    },
  },
},
```

### 2. Authenticate Connections

```typescript
// Use query parameters or headers for authentication
wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!isValidToken(token)) {
    ws.close(1008, "Unauthorized");
    return;
  }
});
```

### 3. Input Sanitization

```typescript
message(ws, message) {
  // Sanitize and validate all input
  const sanitized = sanitizeInput(message);
  const validated = validateMessage(sanitized);

  if (!validated) {
    ws.send(JSON.stringify({ error: "Invalid input" }));
    return;
  }

  processMessage(validated);
}
```

---

## Summary

WebSocket support in Balda is:

- **Runtime-aware**: Different implementations for Node.js, Bun, and Deno
- **Opt-in**: Only enabled when explicitly configured
- **Safe by default**: No upgrade attempts without configuration, and every upgrade is vetoable from the runtime tap hook on Bun/Deno
- **Flexible**: Full control over connection lifecycle

Choose the approach that best fits your runtime:

- **Node.js**: Use `ws` library for maximum control and ecosystem compatibility
- **Bun**: Use native websocket with excellent performance and backpressure handling
- **Deno**: Use native websocket with Web standard APIs
