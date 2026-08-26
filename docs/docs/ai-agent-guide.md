---
id: ai-agent-guide
title: AI Agent Guide
description: Self-contained guide for AI coding assistants to bootstrap and write idiomatic, type-safe balda apps — usable before the project is set up.
keywords: [balda, ai, agents.md, llm, coding agent, guide, bootstrap, best practices]
sidebar_position: 1
slug: /ai-agent-guide
---

# AI Agent Guide

This page is a self-contained brief for **AI coding assistants** working with balda. It is written so an agent can read it from scratch and both **bootstrap a new project** and **write idiomatic, type-safe balda code** — even before the framework is installed.

:::note Scope
The advice below applies **only when working with balda**. It is intentionally scoped and does **not** override a project's general conventions elsewhere in the codebase. When in doubt about non-balda concerns, follow the project's existing rules.
:::

:::tip
The README's "Quick Start" still shows the older decorator style (`@controller`/`@get`). **Prefer the functional router shown below** — the decorators are deprecated and provide weaker type inference.
:::

## 1. Bootstrap from scratch

You can set up a balda project in a clean directory. `npx balda init` assumes balda is already installed as a project dependency, so install it first:

```bash
mkdir my-app && cd my-app
npm init -y
npm install balda
npx balda init            # creates src/server.ts, src/index.ts, src/logger.ts

# Optional services (add only what you need):
# npx balda init -m   # MQTT
# npx balda init -c   # Cron
# npx balda init -g   # GraphQL
```

Day-to-day commands:

| Command | Purpose |
| --- | --- |
| `npx balda serve` | Run the dev server with hot reload (auto-detects Node/Bun/Deno) |
| `npx balda build` | Build for production (Node.js only) |
| `npx balda list` | List all available commands |
| `npx balda key-generate` | Generate app encryption key pairs |
| `npx balda cron-start` | Start the cron scheduler |
| `npx balda queue-start` | Start queue workers |

## 2. Routing — prefer the functional router, not decorators

Use `router.get/post/put/patch/delete(path, options?, handler)` from `balda`. The `@controller`, `@get`, `@post`, … decorators are deprecated wrappers — use the router directly.

Define handlers **inline on the router** so TypeScript infers `req.params` (from the path string), `req.body`, `req.query`, `req.headers`, and the typed `res` from the route options. Do **not** wrap handlers in functions that widen these inferred types — the inference is the whole point.

Group shared-prefix routes (and apply shared middleware) with `router.group(path, middlewares?, (r) => { ... })`.

```ts
import { Server, router } from "balda";
import { z } from "zod";

const CreateUser = z.object({ name: z.string(), age: z.number() });

// Types are inferred: req.body is { name: string; age: number }, res is typed.
router.post("/users", { body: CreateUser }, async (req, res) => {
  res.created({ id: 1, ...req.body });
});

router.group("/api/v1", (r) => {
  r.get("/items/:id", async (req, res) => {
    req.params.id; // typed as string
    res.ok({ id: req.params.id });
  });
});

const server = new Server({ port: 3000, host: "0.0.0.0" });
server.listen();
```

## 3. Validation — Zod at the boundary

Validate input via **Zod schemas passed in the route options**: `{ body, query, headers, all }`. This is the preferred, complete form — the `@validate` decorator only supports `body`/`query`/`all` and has no `headers`.

- Validation failure returns **422 Unprocessable Entity** (`res.unprocessableEntity()`), **not** 400.
- Reuse the **same Zod schemas** for the typed SDK (`npx balda generate-sdk`) rather than duplicating types.

```ts
const UserQuery = z.object({ search: z.string().optional() });

router.get("/users", { query: UserQuery }, async (req, res) => {
  req.query.search; // typed: string | undefined
  res.ok([]);
});
```

## 4. Responses — typed shorthands + serializer

Use the **typed shorthand response methods** instead of `res.status(n).json(...)`:

| Method | Status |
| --- | --- |
| `res.ok(body?)` | 200 |
| `res.created(body?)` | 201 |
| `res.accepted(body?)` | 202 |
| `res.noContent()` | 204 |
| `res.badRequest(body?)` | 400 |
| `res.unauthorized(body?)` | 401 |
| `res.forbidden(body?)` | 403 |
| `res.notFound(body?)` | 404 |
| `res.conflict(body?)` | 409 |
| `res.unprocessableEntity(body?)` | 422 |
| `res.tooManyRequests(body?)` | 429 |
| `res.internalServerError(body?)` | 500 |

Declare response schemas with the `responses` option (`Record<number, schema>`): the shorthand **body arguments become typed** against the matching status code, and Swagger/OpenAPI docs are generated automatically.

```ts
router.get(
  "/users/:id",
  {
    responses: {
      200: UserSchema,
      404: z.object({ error: z.string() }),
    },
  },
  async (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.notFound({ error: "User not found" });
    res.ok(user); // body typed against UserSchema
  },
);
```

Use `@serialize(schema, { throwErrorOnValidationFail: true })` to **validate and fast-serialize** a response body. The serializer is schema-based JSON serialization (via `fast-json-stringify`); it does **not** change key casing.

### Serializer variants for response shapes

For shaping domain objects into response DTOs (stripping internal fields, projecting subsets), use the **`serializer()` builder with named variants**. Define one serializer with multiple output shapes, then resolve the right one per route with `.useVariant(name, data)`. The framework's `res.json()`/`res.send()` already handles JSON serialization — the serializer's job is **transforming the data shape**, not re-serializing.

```ts
import { serializer } from "balda";

type User = { id: number; name: string; email: string; role: string };

const userSerializer = serializer<User>()
  .defineVariant("public", (u) => ({ id: u.id, name: u.name }))
  .defineVariant("full", (u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
  }));

router.get("/users/:id", async (req, res) => {
  const user = await findUser(req.params.id);
  res.ok(await userSerializer.useVariant("public", user)); // { id, name } only
});

router.get("/admin/users/:id", async (req, res) => {
  const user = await findUser(req.params.id);
  res.ok(await userSerializer.useVariant("full", user)); // full shape
});
```

Variant names are **type-safe** — `useVariant()` only accepts declared variants (calling an undefined one is a compile error, and throws a descriptive error at runtime).

Optionally attach an output schema to a variant and **runtime-validate** the DTO at call time. By default the schema is type-only; pass `{ validate: true }` to enforce it:

```ts
const userSerializer = serializer<User>().defineVariant(
  "public",
  (u) => ({ id: u.id, name: u.name }),
  PublicUserSchema, // type guard by default
);

// throws if the output doesn't match PublicUserSchema:
await userSerializer.useVariant("public", user, { validate: true });
```

## 5. Handlers

- Signature: `(req, res) => void | Promise<void>`. You may also `return` the 200 body directly.
- Do **not** introduce a single context-object wrapper around `(req, res)` — it loses the inferred types.
- Keep handlers thin: move business logic into services/modules, not into the route.

## 6. Runtime — stay agnostic

balda runs on **Node.js, Bun, and Deno**. In handler/app code, avoid Node-only globals (`process`, `__dirname`, `node:fs`, …). Use balda's runtime-agnostic helpers when you need filesystem or process access. Use the configured **pino `logger`**, not `console.log`.

## 7. Cron jobs

balda cron jobs are **Node.js only** and require the `node-cron` peer dependency (`npm install node-cron`; the UI also needs `cronstrue`). `npx balda init -c` installs it and scaffolds `src/cron/`.

Two first-class APIs; the docs prefer the **programmatic `cron()` factory** for new code:

```ts
import { cron } from "balda";

// Programmatic — returns a handle you control.
const cleanup = cron("0 0 * * *", { name: "daily-cleanup" });
await cleanup.start(async () => {
  /* run cleanup */
});
cleanup.stop();    // pause (restartable via start())
cleanup.destroy(); // release resources
```

```ts
import { BaseCron, cron } from "balda";

// Class-based — scoped logger, registered via decorator.
export default class extends BaseCron {
  @cron("*/5 * * * *")
  handle() {
    this.logger.info("running every 5 minutes");
  }
}
```

Bootstrap the scheduler after importing cron files: `await CronService.run()`. Alternatively declare them inline via `new Server({ background: { crons: [...] } })`. CLI: `npx balda generate-cron` scaffolds a job, `npx balda cron-start` runs the scheduler (default pattern `src/crons/**/*.{ts,js}`).

Best practices:
- A throwing handler is **logged but does not crash the server**. Handle errors per job with the `onFailed` option, or globally with `setCronGlobalErrorHandler(handler)`.
- The **Cron UI is publicly accessible by default** — protect it with auth middleware in production, or render it behind your own authenticated route via `cronUIInstance`.
- Run the scheduler in a **separate process** from the web server (PM2/systemd / `npx balda cron-start`).

## 8. Queues

Define a **typed queue** with a provider factory, then publish and subscribe. Built-in providers: `bullmqQueue`, `sqsQueue`, `pgbossQueue`, `memoryQueue` (dev only) — or `createQueue` with a custom `GenericPubSub`. Each needs its driver peer deps (`npx balda init-queue -t <bullmq|sqs|pgboss>` installs them).

```ts
import { bullmqQueue, defineQueueConfiguration } from "balda";

// Configure once at bootstrap.
defineQueueConfiguration({
  bullmq: { connection: { host: "127.0.0.1", port: 6379 } },
});

// Typed payload — publish and handler are both generically typed.
export const orderQueue = bullmqQueue<{ orderId: number }>("orders");

await orderQueue.publish({ orderId: 1 }, { attempts: 3, backoff: { type: "exponential" } });

const sub = await orderQueue.subscribe(async (payload) => {
  // payload is typed { orderId: number }
});
await sub.unsubscribe();
```

The **programmatic `subscribe(handler)`** form (returning a handle) is preferred for new code. For the decorator form on a class method, use `@orderQueue.subscribeMethod()` — the no-arg `@queue.subscribe()` decorator is deprecated. Bootstrap workers with `QueueService.run()`, or via `new Server({ background: { queues: { config, run: true } } })`. CLI: `npx balda generate-queue`, `npx balda queue-start`.

:::caution generate-queue scaffold
The `npx balda generate-queue` scaffold currently emits a `@queue(...)`/`BaseQueue` form that is **not** part of the public exports and will not compile. Use the factory-based form above (`bullmqQueue`/`sqsQueue`/`pgbossQueue` + `subscribe(handler)` or `@queue.subscribeMethod()`) instead.
:::

Best practices:
- **One payload type per queue** — both `publish` and the handler are generically typed; don't widen with `any`.
- **Centralized queue registry** — define all queues once in a `src/queues/index.ts` (`as const` map) for a single source of truth, then import them where you publish/consume.
- **Retry/backoff at publish time** per provider (BullMQ `attempts`/`backoff`, PGBoss `retryLimit`/`retryDelay`, SQS `DelaySeconds`). Use the provider config's `errorHandler` for global failure logging.
- Call `defineQueueConfiguration` **once** at bootstrap.
- Run **dedicated worker processes** (`npx balda queue-start`) separate from the web server for scalability. Use `memoryQueue` for tests/dev only.

## 9. MQTT

balda connects to an external MQTT broker. The feature needs Node.js-compatible environments and the `mqtt` peer dependency (`npx balda init -m` installs it and scaffolds `src/mqtt/`). The docs prefer the **programmatic API** for new code.

```ts
import { mqtt, MqttService } from "balda";

await MqttService.connect({ host: "localhost", port: 1883 });

// Type-safe topic helper
const sensor = mqtt.topic<{ value: number; unit: string }>("home/temperature");
await sensor.subscribe((message) => console.log(`${message.value}${message.unit}`));
await sensor.publish({ value: 21, unit: "C" });

// Or subscribe directly (returns a handle)
const handle = await mqtt.subscribe("home/humidity", (message) => { /* ... */ }, { qos: 1 });
await handle.unsubscribe();

await MqttService.disconnect(); // graceful shutdown
```

For class-based handlers with a scoped logger, extend `BaseMqtt` and use the `@mqtt.subscribe("topic")` decorator. The handler signature is `(message)` — or `(topic, message)` when using MQTT wildcards (`+` single-level, `#` multi-level).

Type-safe topics come from augmenting the `MqttTopics` interface:

```ts
declare module "balda" {
  interface MqttTopics {
    "home/temperature": { value: number; unit: string };
  }
}
```

Bootstrap either by calling `MqttService.connect()` after importing handler files, or via `new Server({ background: { mqtt: { connect, subscribe } } })`. Scaffold a handler with `npx balda generate-mqtt <topic>` (the topic is a **positional** argument, not a `-t` flag).

Best practices:
- Register a custom error sink with `setMqttGlobalErrorHandler(fn)` (the default just logs).
- Prefer the single-param `(message)` handler unless you need wildcard topics.
- Call `MqttService.disconnect()` on shutdown for a clean broker disconnect.

## 10. Middleware

Middleware signature is `(req, res, next) => SyncOrAsync` — call `next()` to continue the chain, or end the response directly.

Application levels (execution order is **Global → Controller → Route → Handler**):

- **Global**: `server.use(mw)` or `plugins: [mw1, mw2]`.
- **Route-level**: the route option `middlewares: [mw]`.
- **Group**: `router.group("/api/v1", [authMiddleware], (r) => { r.get(...) })`.

```ts
const authMiddleware = (req, res, next) => {
  if (!req.headers.authorization) return res.unauthorized({ error: "Missing token" });
  next();
};

router.group("/api/admin", [authMiddleware], (r) => {
  r.get("/dashboard", (req, res) => res.ok({ ok: true }));
});
```

For **type inference** of `req` extensions in downstream handlers, define middleware with `defineMiddleware<T>()`, which returns a `TypedMiddleware<T>`. Type inference works for `router.*` and `router.group` routes (not for the deprecated `@controller` decorators). Use middleware for cross-cutting concerns (auth, logging, request IDs) instead of repeating checks inside handlers.

## 11. Policies

Policies are balda's authorization layer. Build a `PolicyManager` from a record of provider checks, then create a decorator from it:

```ts
import { PolicyManager } from "balda";

export const policyManager = new PolicyManager({
  users: {
    isAdmin: (user: { role: string }) => user.role === "admin",
    canDelete: (user: { id: string }, targetId: string) =>
      user.id === targetId || user.role === "admin",
  },
});
export const policy = policyManager.createDecorator();

// Decorator form (class + method, stackable — all must pass)
@policy("users", "isAdmin")
class AdminController {
  @policy("users", "canDelete")
  async delete(req, res) { /* ... */ }
}

// Inline route option (single or array — all must pass)
router.delete("/users/:id", { policy: { manager: policyManager, scope: "users", handler: "canDelete" } }, (req, res) => {
  /* ... */
});
```

Manual check (e.g. in a handler that already has the user): `await policyManager.canAccess("users", "isAdmin", user)` — on failure return `res.forbidden()`. Policies run **before** route middlewares; failure returns **401** by default. Override the failure response with `server.setPolicyErrorHandler({ status, map })`.

## 12. Caching

Enable caching under `plugins.cache` (**not** a top-level `cache` key). Redis uses the `ioredis` peer dependency; memory needs none.

```ts
new Server({
  plugins: { cache: { provider: "memory", defaultTtl: 300 } }, // or provider: "redis", redis: { url }
});
```

Apply per route via the **type-safe** route option `cache`, or the `@cache(...)` decorator (`ttl` in seconds, max 86400):

```ts
router.get("/users/:id", { cache: { ttl: 60, tags: ["users"] } }, (req, res) => { /* ... */ });
```

Invalidate with the cache service — tag-based for bulk, pattern for glob:

```ts
import { getCacheService } from "balda";

await getCacheService()?.invalidate(["users"]);                       // by tag
await getCacheService()?.invalidatePattern("cache:GET:/api/users*");  // by pattern
```

The response carries an `x-cache` header (`HIT`/`MISS`/`WAIT`/`BYPASS`). `lockBehavior` controls thundering-herd protection: `"wait"` (default) coalesces concurrent misses, `"bypass"` lets them through, `"fail"` returns 503 with `Retry-After`. Invalidate-on-write: call `invalidate(["users"])` inside the `@post`/`@put`/`@del` handlers that mutate users.

## 13. Error handling

Prefer the typed `res.<status>()` helpers for **client** errors (`res.badRequest()`, `res.unauthorized()`, `res.forbidden()`, `res.notFound()`, `res.unprocessableEntity()`) rather than throwing.

`BaldaError` and its subclasses are **framework-internal** (route-not-found, method-not-allowed, file-not-found, etc.) — they are not a generic "throw to set HTTP status" API.

A thrown error does **not** automatically produce a 500 JSON response. Register a global handler to catch thrown errors and return a sanitized response:

```ts
server.setErrorHandler((req, res, next, error) => {
  logger.error({ err: error }, "Unhandled error");
  res.internalServerError({ error: "Internal Server Error" });
});
```

Customize validation and policy failure responses with **options objects** (not callbacks):

```ts
// Validation failures default to 422 (Unprocessable Entity), not 400.
server.setValidationErrorHandler({
  status: 422,
  map: (error, req) => ({ code: "VALIDATION_FAILED", details: error }),
});

server.setPolicyErrorHandler({
  status: 401,
  map: (req) => ({ code: "UNAUTHORIZED", message: "Not allowed" }),
});

server.setNotFoundHandler((req, res) => res.notFound({ error: "Route not found" }));
```

Set `NODE_ENV=production` so `BaldaError` serialization omits stack traces.

## 14. GraphQL

Enable GraphQL on the server. The endpoint is fixed at **`/graphql`** and works across Node/Bun/Deno. `npx balda init -g` installs `@apollo/server`, `@graphql-tools/schema`, and `graphql`.

```ts
const server = new Server({
  graphql: {
    schema: {
      typeDefs: `type Query { hello: String }`,
      resolvers: { Query: { hello: () => "Hello from GraphQL!" } },
    },
    apolloOptions: { introspection: true, csrfPrevention: false }, // dev/Sandbox
  },
});
```

Extend the schema dynamically **before the first request** (the executable schema is built lazily on first GraphQL request):

```ts
server.graphql.addTypeDef(`type Book { id: ID! title: String! } extend type Query { books: [Book!]! }`);
server.graphql.addResolver("Query", { books: () => fetchBooks() });
server.graphql.addResolver("Book", { author: (parent) => fetchAuthor(parent.id) });
```

Pass context via `apolloOptions.context = ({ req }) => ({ ... })` and type it through module augmentation of `GraphQLContext`. Best practices: enable `introspection` only in dev, use `formatError` in production, and `csrfPrevention: false` for the local Apollo Sandbox.

## 15. Storage

`Storage` is a multi-provider façade. Construct providers and pass them in with a `defaultProvider`:

```ts
import { Storage, S3StorageProvider } from "balda";

const storage = new Storage(
  { s3: new S3StorageProvider({ s3ClientConfig: { region: "us-east-1", credentials, bucketName: "my-bucket" } }) },
  { defaultProvider: "s3" },
);

await storage.putObject("uploads/file.pdf", buffer, "application/pdf");
const data: Uint8Array = await storage.getObject("uploads/file.pdf");   // "raw" (default) | "text" | "stream"
const url = await storage.getDownloadUrl("uploads/file.pdf", 7200);    // presigned, 2h
await storage.deleteObject("uploads/file.pdf");

// One-off different provider:
await storage.use("local").putObject("tmp.txt", buffer);
```

Providers: **S3** (`@aws-sdk/client-s3` etc.; on Node/Deno a download URL needs CloudFront config), **Azure Blob** (`@azure/storage-blob`), **Local** (no external deps, but `getDownloadUrl`/`getUploadUrl`/`getPublicUrl` throw — local is for read/write only). `getObject` throws `FileNotFoundError` on a missing key. Scaffold with `npx balda init-storage -t <s3|azure|local>` (the registered command name is `init-storage`).

Best practices: use S3 or Azure (not local) when you need presigned URLs for direct client upload/download; use `getObject(..., "stream")` for large files.

## 16. Mailer

nodemailer-based, multi-provider, **builder-callback** API:

```ts
import { Mailer, HandlebarsAdapter } from "balda";
import nodemailer from "nodemailer";

export const mailer = new Mailer(
  {
    default: {
      transporter: nodemailer.createTransport({ host: "localhost", port: 1025, ignoreTLS: true }),
      templateAdapter: new HandlebarsAdapter(),
      from: "noreply@example.com",
    },
  },
  { defaultProvider: "default" },
);

await mailer.send((b) => b.to("user@example.com").subject("Welcome!").html("<h1>Hi</h1>"));
await mailer.send((b) => b.to("user@example.com").subject("Hi {{name}}").template("<h1>Hello {{name}}</h1>", { name: "John" }));
await mailer.later((b) => b.to("user@example.com").subject("Newsletter").text("...")); // background, in-memory, 1s spacing
await mailer.use("sendgrid").send((b) => b.to("x@example.com").subject("...").text("..."));
```

`send` runs immediately via the default provider; `later` enqueues in an **in-memory** queue (not SQS/Redis) with 1-second spacing. Template adapters: Handlebars, Ejs, Edge, Mustache, Custom. `Email` is a template-literal type (`` `${string}@${string}` ``). Scaffold with `npx balda init-mailer -t <handlebars|ejs|edge|mustache|custom|none>`.

:::caution init-mailer scaffold
The generated `mailer.config.ts` comments show `mailer.send({ to, subject })` and `mailer.sendWithTemplate(...)`. Both are wrong — `send` takes a **builder callback** and `sendWithTemplate` is private. Use the builder-callback form above.
:::

Best practices: run MailCatcher (SMTP 1025, web UI 1080) for local dev; use `later(...)` for bulk/rate-limited sending; define multiple providers and switch with `mailer.use("provider")`.

## 17. Testing

**Always test through the built-in mock server — do not start a real listening server or issue real HTTP requests in tests.** `server.inject` / `server.getMockServer()` runs the full middleware/plugin chain in-process with no network socket, so it needs no port and works identically under Node, Bun, and Deno.

```ts
import { server } from "../src/server";

const mock = server.getMockServer(); // or the shorthand server.inject.get(path)

const res = await mock.get<User[]>("/users");
expect(res.statusCode()).toBe(200);
res.assertBodySubset([{ id: 1 }]);

const created = await mock.post<User, CreateUser>("/users", { body: { email: "a@b.c" } });
created.assertStatus(201).assertBodyDeepEqual({ id: 4, email: "a@b.c" });
```

- `server.inject` exposes `.get/.post/.put/.patch/.delete` shortcuts on a shared instance; `server.getMockServer({ controllerPatterns })` gives a dedicated instance. Both lazily bootstrap controllers/plugins on the first request.
- `MockResponse` assertions (return `this` for chaining): `assertStatus`, `assertHeader` / `assertHeaderExists` / `assertHeaderNotExists`, `assertCookie` / `assertCookieExists` / `assertCookieNotExists`, `assertBodySubset`, `assertBodyDeepEqual`, `assertBodyNotSubset`, `assertBodyNotDeepEqual`, `assertCustom`.
- Request options: `body`, `formData` (multipart), `urlencoded`, `headers`, `query`, `cookies`, `ip` (at most one of `body`/`formData`/`urlencoded`).
- Use the TypeScript generics (`mock.post<User, CreateUser>(...)`) for compile-time body/query types.
- The router is a **singleton** shared process-wide, so routes registered by one test file leak into the next. If a test registers routes itself (ad-hoc `router.get(...)` calls, mounting a plugin like `mountBetterAuth`) rather than importing an already-bootstrapped `server`, call `router.clearRoutes()` in `beforeEach`/`afterEach` to reset it.

## 18. CLI / scaffolding reference

Pick the right generator instead of hand-writing boilerplate:

| Command | Purpose |
| --- | --- |
| `npx balda init` | Scaffold `server.ts`, `index.ts`, `logger.ts` (+ optional mqtt/cron/graphql) |
| `npx balda init-queue` | Initialize a queue config |
| `npx balda init-mailer` | Initialize a mailer config |
| `npx balda init-storage` | Set up a storage provider with required dependencies |
| `npx balda generate-controller` | Scaffold a controller file |
| `npx balda generate-middleware` | Scaffold a middleware file |
| `npx balda generate-plugin` | Scaffold a plugin file |
| `npx balda generate-cron` | Scaffold a cron job |
| `npx balda generate-mqtt` | Scaffold an MQTT handler |
| `npx balda generate-queue` | Scaffold a queue |
| `npx balda generate-sdk` | Generate a typed client SDK from your routes/schemas |
| `npx balda generate-command` | Scaffold a custom CLI command |

## 19. Where to look next

- [Getting Started](./getting-started/installation) — install & quick start
- [Core Concepts](./core-concepts/server) — server, routing, request/response, serializer, middleware, policies
- [Commands → Built-in Commands](./commands/overview) — every CLI command in detail
- [Queues](./queues/overview) · [Cron](./cron/overview) · [MQTT](./mqtt/overview) · [Storage](./storage/overview) · [Mailer](./mailer/overview)
- [Testing](./testing/overview) — built-in mock server for testing handlers