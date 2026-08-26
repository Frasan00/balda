---
title: Packages
description: Balda is a single package. Reference of what it exports, grouped by feature area.
keywords: [balda, packages, exports, core, mqtt, cron, queue, storage, mailer, graphql, cache]
sidebar_position: 2
---

# Packages

Balda is a **single package** — `balda`. Everything is exported from one entry point. The third‑party drivers each feature relies on are **optional peer dependencies** loaded lazily at runtime, so installing `balda` alone never pulls in `mqtt`, `bullmq`, `@apollo/server`, etc. — you only install the driver for the feature(s) you use.

See [Installation](./installation) for setup.

## Core (server, runtime, decorators, plugins)

The HTTP server, multi‑runtime layer, decorators, validator/serializer and the base plugins. This is what you get from `balda` with no extra drivers installed.

```ts
import {
  Server,
  router,
  // decorators
  controller, get, post, put, patch, del,
  middleware, validate, serialize, cache,
  // base plugins
  cors, helmet, cookie, bodyParser, compression, log,
  rateLimiter, session, serveStatic, timeout, trustProxy,
  methodOverride, asyncLocalStorage,
  // express interop
  createExpressAdapter, expressMiddleware, mountExpressRouter, expressHandler,
  // better-auth interop (see Better Auth docs)
  mountBetterAuth, betterAuthHandler,
  // policy
  createPolicyDecorator, PolicyManager,
  // commands / CLI
  Command, commandRegistry,
  // misc
  logger, hash, serializer, defineMiddleware,
} from "balda";
```

Runtime dependencies: `ajv`, `fast-json-stringify`, `pino`. Everything else (graphql, cache, express, zod, typebox, esbuild, …) is an **optional peer** loaded on demand.

See [Better Auth](../better-auth/overview) for the `mountBetterAuth` / `betterAuthHandler` adapter — same optional-peer model, `better-auth` is a type-only dependency until you install it yourself.

## Cron

Cron scheduler and `@cron()` decorator. Driver: `node-cron`; `cronstrue` is only required if you use the [cron UI](../cron/ui) (it's opt‑in).

```ts
import {
  cron, BaseCron, CronService, setCronGlobalErrorHandler, cronUi, cronUIInstance,
} from "balda";
```

:::note
The cron dashboard UI is **opt‑in** and self‑contained inside `balda`. It is not mounted automatically — call `cronUi` explicitly to expose it.
:::

## MQTT

MQTT service and decorator. Driver: `mqtt`.

```ts
import {
  MqttService, mqtt, setMqttGlobalErrorHandler, BaseMqtt,
} from "balda";
```

## Queues

Typed queues with pluggable providers. Install **only the driver(s) for the provider(s) you use**: `bullmq`, `pg-boss`, or `sqs-consumer` + `@aws-sdk/client-sqs`. The in‑memory provider needs no driver.

```ts
import {
  bullmqQueue, sqsQueue, pgbossQueue, memoryQueue, createQueue,
  QueueManager, QueueService, defineQueueConfiguration,
  TypedQueue, CustomTypedQueue,
  BullMQPubSub, MemoryPubSub, PGBossPubSub, SQSPubSub,
} from "balda";
```

```bash
pnpm add bullmq   # only if you use BullMQ
```

## Storage

Storage abstraction over local filesystem, S3 and Azure Blob. Install **only the driver(s) you use**: `@aws-sdk/client-s3` (+ `@aws-sdk/s3-request-presigner` / `@aws-sdk/cloudfront-signer` for presigned URLs on Node/Deno) and/or `@azure/storage-blob`. The local provider needs no driver.

:::note
On **Bun**, the S3 provider uses Bun's native `Bun.S3Client` and does **not** require `@aws-sdk/client-s3` for puts/gets/presigned URLs. `@aws-sdk/client-s3` is still needed on Bun only for `listObjects` and CloudFront signing.
:::

```ts
import {
  Storage,
  S3StorageProvider, AzureBlobStorageProvider, LocalStorageProvider,
} from "balda";
```

```bash
pnpm add @aws-sdk/client-s3   # only if you use S3 (Node/Deno)
```

## Mailer

Mailer with template adapters. Driver: `nodemailer` (required) plus one template engine of your choice: `handlebars`, `ejs`, `mustache`, or `edge.js`.

```ts
import {
  Mailer, MailProvider, MailOptionsBuilder,
  HandlebarsAdapter, EjsAdapter, MustacheAdapter, EdgeAdapter, CustomAdapter,
} from "balda";
```

```bash
pnpm add nodemailer handlebars
```

:::note
The mailer is self‑contained and does **not** depend on the queue feature — it ships its own lightweight in‑memory delivery queue.
:::

## GraphQL

GraphQL integration built on Apollo Server. Drivers: `@apollo/server`, `graphql`, `@graphql-tools/schema`.

```ts
import { GraphQL, type GraphQLContext } from "balda";
```

Pass an instance to the server:

```ts
import { Server, GraphQL } from "balda";

const graphql = new GraphQL({ schema: { typeDefs, resolvers } });
const server = new Server({ graphql });
```

Balda loads `@apollo/server` lazily the moment you enable the `graphql` option, so installing `balda` alone never pulls in Apollo.

## Cache

Route‑level caching with in‑memory and Redis providers. Driver: `ioredis` (only for the Redis provider).

```ts
import {
  cacheMiddleware, initCacheService, getCacheService, resetCacheService,
  CacheService, MemoryCacheProvider, RedisCacheProvider,
  CacheStatus, CACHE_STATUS_HEADER,
} from "balda";
```

The `@cache()` route decorator and the route‑level `cache:` config are part of the routing contract in core; `initCacheService()` registers the cache middleware factory. Importing and initializing the cache runtime registers it with the server automatically.

```ts
import { Server, controller, get, cache } from "balda";
import { initCacheService, MemoryCacheProvider } from "balda";

initCacheService(new MemoryCacheProvider(), { defaultTtl: 60 });

@controller("/users")
class UsersController {
  @cache({ ttl: 30 })
  @get("/")
  list(_req, res) { res.json([]); }
}
```

```bash
pnpm add ioredis   # only if you use the Redis provider
```