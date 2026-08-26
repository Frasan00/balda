---
title: The fetch() Handler
description: server.fetch() — a Web-standard fetch(request) => Promise<response> handler for platforms that don't let you bind a port.
keywords: [balda, fetch, deno deploy, supabase, vercel, netlify, service worker, web standard]
sidebar_position: 2
---

# The `fetch()` Handler

`server.fetch` is a Web-standard handler:

```typescript
fetch: (request: Request) => Promise<Response>
```

It runs the same routing pipeline as `listen()` — match the route, build the request, run
middleware and the handler, serialize the response — without starting a platform-specific
server. Use it on any target that hands you a `Request` and expects a `Response` back instead
of letting you bind a port.

Like `server.inject()`, it lazily bootstraps the server (imports controllers, applies plugins)
on its first call.

## Deno Deploy / Supabase Edge Functions

```typescript
import { Server } from "balda";

const server = new Server({ swagger: false });

Deno.serve(server.fetch);
```

Both platforms run on Deno, so `server.listen()` also works if you'd rather bind a port
yourself — `Deno.serve(server.fetch)` is the idiomatic form these platforms expect.

## Vercel / Netlify Functions (Node runtime)

```typescript
import { Server } from "balda";

const server = new Server({ swagger: false });

export default server.fetch;
```

## A Service Worker

```typescript
self.addEventListener("fetch", (event) => {
  event.respondWith(server.fetch(event.request));
});
```

## Controller autoloading needs a real filesystem

`controllerPatterns` imports controllers by globbing the filesystem at bootstrap time. Deno
Deploy and Supabase Edge Functions don't give you one — register routes and controllers
explicitly on those targets rather than relying on autoloading.

## What it doesn't do

`server.fetch()` doesn't handle WebSocket upgrades. A WS upgrade needs the underlying
platform's native upgrade mechanism (`server.upgrade()` on Bun, `Deno.upgradeWebSocket()` on
Deno), which only exists once the server is actually `listen()`-ing on a real connection — not
something a bare `Request` can carry. If you need WebSockets, use `listen()`.
