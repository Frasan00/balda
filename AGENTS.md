# Balda

Balda is a TypeScript backend framework with a decorator-first HTTP server, native adapters for Node.js, Bun, and Deno, and optional integrations for queues, storage, mail, MQTT, GraphQL, and validation.
It builds npm packages with tsup, runs integration dependencies through Docker Compose, and deploys through standard server listeners, fetch handlers, or AWS Lambda adapters.

## Features

### http-server
Runs decorated controllers, middleware, plugins, and HTTP/HTTPS/HTTP2 request handling across all supported runtimes.
Entry points: `src/index.ts`, `src/server/server.ts`, `src/server/router/router.ts`, `src/runtime/native_server/server_connector.ts`

### runtime-adapters
Selects and implements the Node.js, Bun, and Deno native server and platform APIs behind one framework interface.
Entry points: `src/runtime/runtime.ts`, `src/runtime/native_server/server_node.ts`, `src/runtime/native_server/server_bun.ts`, `src/runtime/native_server/server_deno.ts`

### validation-and-serialization
Validates requests and response schemas with Ajv, Zod, or TypeBox and serializes typed response data.
Entry points: `src/validator/validator.ts`, `src/ajv/ajv.ts`, `src/serializer/serializer.ts`, `src/decorators/validation/validate.ts`

### plugins
Provides opt-in HTTP capabilities including authentication, sessions, caching, CORS, compression, Express interoperability, static files, Swagger, and rate limiting.
Entry points: `src/server/server.ts`, `src/plugins/better_auth/better_auth.ts`, `src/plugins/session/session.ts`, `src/plugins/swagger/swagger.ts`

### queues-and-scheduling
Runs typed background queues and cron jobs using BullMQ, PG-Boss, SQS, memory, or custom providers.
Entry points: `src/queue/queue_service.ts`, `src/queue/factories.ts`, `src/cron/cron.ts`, `src/cron/cron_factory.ts`

### storage-and-mail
Handles local, S3, and Azure Blob storage plus SMTP email and template rendering.
Entry points: `src/storage/storage.ts`, `src/storage/providers/s3.ts`, `src/storage/providers/blob_storage.ts`, `src/mailer/mailer.ts`

### messaging-and-graphql
Connects MQTT topics and GraphQL schemas/resolvers to the server lifecycle.
Entry points: `src/mqtt/mqtt.ts`, `src/mqtt/base_mqtt.ts`, `src/graphql/graphql.ts`, `src/server/server.ts`

### cli-and-code-generation
Exposes the `balda` CLI for project setup, scaffolding, queue work, and server commands.
Entry points: `src/cli.ts`, `src/commands/command_registry.ts`, `src/commands/base_commands/init_command.ts`, `src/commands/base_commands/serve_command.ts`

## Development

- Ask the user for clarification when a requested behavior, scope, or tradeoff is materially unclear; do not guess product requirements.
- Always use `docker-compose.worktree.yml` for test workflows because it publishes no host ports.
- Start the complete test stack with `yarn docker:worktree:up`, run all runtimes with `yarn test:all:worktree`, then always run `yarn docker:worktree:down`. The teardown removes containers, networks, and volumes via `down -v --remove-orphans`, including after failures.
- Use the runtime-specific worktree commands only when intentionally running a single runtime; still run `yarn docker:worktree:down` afterward.
