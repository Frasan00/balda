---
id: intro
title: Introduction to Balda
description: Balda is a multi-runtime backend framework for Node.js, Bun, and Deno. Build fast APIs with decorators, validation, WebSocket, GraphQL, queues, and cron jobs.
keywords:
  [
    balda,
    introduction,
    overview,
    node.js,
    bun,
    deno,
    backend framework,
    typescript,
  ]
sidebar_position: 0
slug: /
---

# Balda

Balda is a multi-runtime backend framework that lets you write once and run anywhere—**Node.js**, **Bun**, and **Deno**—without changing a single line of code.

## Why Balda?

- **Multi-Runtime**: One codebase runs on Node.js, Bun, or Deno using their native APIs (`http.createServer`, `Bun.serve`, `Deno.serve`)
- **Deploy Anywhere**: `server.listen()` for any container host; `server.fetch()` — a Web-standard `fetch(request) => Promise<response>` handler — for Vercel, Netlify, Deno Deploy, Supabase Edge Functions, and Service Workers; a native `handle()` adapter for AWS Lambda. See [Deployment](./deployment/overview)
- **TypeScript-First**: Full type safety with excellent IntelliSense support
- **Decorator-Based**: Clean, self-documenting code with decorators for routes and middleware
- **Batteries Included**: Controllers, validation, serialization, middleware, cron jobs, queues, GraphQL, and more
- **Auto-Generated Docs**: Swagger/OpenAPI documentation generated from your code
- **Performance Focused**: Minimal overhead with lean abstractions

## Quick Example

```typescript
import { Server, controller, get } from "balda";

const server = new Server({
  port: 3000,
  plugins: {
    // Without body parser plugin, the body won't be parsed and will be undefined
    bodyParser: {
      json: {
        sizeLimit: "100kb",
      },
    },
  },
});

// controller based routes
@controller()
class HelloController {
  @get("/")
  hello(req, res) {
    res.json({ message: "Hello, Balda!" });
  }
}

// imperative routes
server.router.get("/", (req, res) => {
  res.json({ message: "Hello, Balda!" });
});

server.listen(() => {
  console.log("Server is running on port 3000");
});
```

## Get Started

1. [Install Balda](./getting-started/installation) in your preferred runtime
2. Follow the [Quick Start](./getting-started/quick-start) to build your first API
3. Explore [Core Concepts](./core-concepts/server) to understand how Balda works

:::tip AI Agent Guide
Building a balda app with an AI coding assistant? Read the **[AI Agent Guide](./ai-agent-guide)** — a self-contained brief for coding agents covering project bootstrap and idiomatic, type-safe balda patterns.
:::

## Features

- **Controllers** - Organize routes with classes and decorators
- **Middleware** - Global, controller-level, or route-level middleware support
- **Validation** - Zod schemas for request/response validation
- **Plugins** - CORS, body parsing, rate limiting, compression, and more
- **GraphQL** - Built-in GraphQL support with type safety
- **Queues** - Background job processing with multiple providers
- **Cron Jobs** - Scheduled task execution
- **CLI** - Project generators and development tools
- **Testing** - Built-in mock server for easy testing
