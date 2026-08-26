---
title: Testing Overview
description: Comprehensive testing across Node.js, Bun, and Deno with MockServer and server.inject(). Test controllers and middleware without starting a server.
keywords: [balda, testing, mockserver, inject, unit test, integration]
sidebar_position: 1
---

# Testing Overview

Balda provides comprehensive testing capabilities with support for multiple JavaScript runtimes and powerful tools for testing HTTP endpoints without starting a real server.

## Testing Approaches

Balda offers two complementary ways to test routes without network overhead:

### `server.inject()` — Direct Request Injection

Inject requests directly into the server instance, similar to Fastify's `inject`. Ideal for quick, inline testing:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

// Generic inject
const res = await server.inject("GET", "/users");

// Typed shortcuts
const res = await server.inject.get<User[]>("/users");
const res = await server.inject.post<User>("/users", { body: { name: "John" } });
```

### `MockServer` — Full Testing Utility

A dedicated testing class with the same capabilities, useful when you want a separate test instance:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });
const mock = server.getMockServer(); // synchronous

const res = await mock.get("/users");
```

Both approaches lazily bootstrap the server (import controllers, apply plugins) on the first request — no manual setup required.

## Multi-Runtime Support

Balda supports testing across multiple JavaScript runtimes:

- **Node.js** - Primary runtime with full feature support
- **Bun** - Fast alternative runtime with native TypeScript support
- **Deno** - Modern runtime with built-in security features

## Test Structure

```
test/
├── suite/           # Test suites for different features
│   ├── users.test.ts
│   ├── upload.test.ts
│   └── urlencoded.test.ts
├── controllers/      # Controller implementations for testing
│   ├── users.ts
│   ├── file_upload.ts
│   └── urlencoded.ts
├── server/          # Test server configuration
│   ├── instance.ts
│   └── index.ts
└── benchmark/       # Performance testing
    └── index.ts
```

## Running Tests

### Node.js

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

### Bun

```bash
# Run tests with Bun
yarn test:bun
```

### Deno

```bash
# Run tests with Deno
yarn test:deno
```

## Test Scripts

The project includes several test-related scripts:

- `test` - Run tests with Vitest
- `test:watch` - Run tests in watch mode
- `test:coverage` - Run tests with coverage reporting
- `test:bun` - Run tests with Bun
- `test:deno` - Run tests with Deno
- `benchmark` - Run performance benchmarks

## Pre-commit Testing

Tests are automatically run on pre-commit hooks across all supported runtimes to ensure compatibility and prevent regressions.

## Next Steps

- [MockServer & Inject Guide](./mock-server.md) - Learn how to use MockServer and `server.inject()` for testing
- [Testing Examples](./examples.md) - Practical testing examples and patterns
