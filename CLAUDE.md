# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Balda is a **cross-runtime backend framework** that runs on Node.js, Bun, and Deno. It uses a decorator-based API similar to FastAPI/NestJS and provides native runtime server implementations (`Bun.serve`, `Deno.serve`, Node `http`/`https`).

**Version 0.x - APIs may change. Do not use in production.**

## Common Commands

### Development
- `yarn dev` - Start dev server with hot reload (Node.js)
- `yarn dev:bun` - Start dev server on Bun
- `yarn dev:deno` - Start dev server on Deno

### Build
- `yarn build` - Build ESM + CJS output via tsup (through Docker)
- `yarn build:prod` - Build with minification
- `yarn build:test` - Build and cleanup (for CI)

### Testing
Tests run through Docker containers for all runtimes:
- `yarn test` - Run Vitest tests (Node.js)
- `yarn test:bun` - Run tests on Bun
- `yarn test:deno` - Run tests on Deno
- `yarn test:all` - Run tests across all runtimes
- `yarn test:watch` - Watch mode for Node tests

Note: All test commands require `docker compose up` first.

### Benchmarks
- `yarn benchmark` - Quick benchmark suite
- `yarn benchmark:all` - Full benchmark comparison
- `yarn benchmark:runtime` - Compare runtime performance

### Code Quality
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Auto-fix linting issues
- `yarn format` - Run Prettier

### Docker Environment
The project uses Docker Compose for cross-runtime development. Services include:
- `node`, `bun`, `deno` - Runtime containers
- `redis`, `postgres`, `sqs` (ElasticMQ), `localstack` (S3), `mqtt` (Mosquitto), `azurite` - Infrastructure services

Commands prefixed with `docker compose exec -T node` run inside the Node container.

## Architecture

### Core Design Principle: Runtime Abstraction
The framework abstracts runtime differences through:
- `src/runtime/native_*.ts` - Runtime-specific implementations (server, fs, crypto, os, etc.)
- `src/runtime/runtime.ts` - Runtime detection singleton
- `src/runtime/native_server/` - Unified server interface with per-runtime connectors

### Directory Structure

```
src/
├── decorators/          # @controller, @get, @post, @validate, @middleware, @cron
├── server/             # Core Server class, router, Request/Response types
├── runtime/            # Cross-runtime abstraction layer
├── plugins/            # Middleware (bodyParser, cors, rateLimiter, etc.)
├── validator/          # Zod/Ajv integration with fast-json-stringify caching
├── queue/              # BullMQ, pg-boss, SQS, in-memory queues
├── storage/            # S3, Azure Blob, local file storage
├── mailer/             # Email with EJS/Handlebars/Mustache/Edge templates
├── cron/               # Scheduled job decorator and execution
├── mqtt/               # MQTT client wrapper
├── graphql/            # Apollo Server integration
├── logger/             # Pino-based structured logging
└── cli.ts              # Command-line interface
```

### Key Patterns

**Decorator-Based Routing**: Controllers use class decorators with method-level route handlers. Routes register to a singleton `router` which is consumed by `ServerConnector` at `listen()` time.

**Plugin System**: Plugins are middleware functions conforming to `ServerRouteMiddleware`. The `Server.applyPlugins()` method maps plugin config options to middleware, applied before global middlewares in the request chain.

**Provider Pattern**: Queue and storage implementations share a common interface (`BaseQueue`, `StorageInterface`) with runtime-specific providers (BullMQ, SQS, pg-boss for queues; S3, Azure, local for storage).

**Policy System**: `@policy()` decorator attaches authorization rules to routes. `PolicyManager` evaluates rules before route handlers execute.

### Entry Points
- `src/index.ts` - Main library exports
- `src/cli.ts` - CLI entry point (bin: `balda`)
- `src/server/server.ts` - Core `Server` class

### Important Implementation Notes

**Build Output**: tsup produces both ESM (`.js`) and CJS (`.cjs`) outputs with TypeScript declarations (`.d.ts`). Many dependencies are marked as `external` to remain peer dependencies.

**Controller Auto-Import**: Using `controllerPatterns` in Server options, the framework uses `glob` to dynamically import controller files. This happens during `bootstrap()` before `listen()`.

**Validation Caching**: Ajv schemas are compiled and cached with fast-json-stringify for serialization performance. The `AjvStateManager` manages a global Ajv instance.

**Express Compatibility**: While using native runtime servers, Balda can mount Express routers via `createExpressAdapter()` and `expressMiddleware()` for migration scenarios.

**Error Handling**: Custom error hierarchy extends `BaldaError`. `errorFactory()` standardizes error responses. The server auto-registers 404/405 handlers for unmatched routes.

## Testing Strategy

- Unit tests use Vitest with `test/**/*.test.ts` pattern
- Mock server available via `server.getMockServer()` for testing without network
- Benchmark suite uses autocannon for performance regression testing
- Cross-runtime testing validates behavior parity across Node/Bun/Deno
