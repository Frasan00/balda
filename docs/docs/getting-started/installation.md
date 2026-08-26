---
title: Installation
description: Install Balda on Node.js, Bun, or Deno. A single package with optional peer drivers you install only when you need them.
keywords:
  [
    balda,
    installation,
    setup,
    node.js,
    bun,
    deno,
    typescript,
    npm,
    pnpm,
    getting started,
  ]
sidebar_position: 1
---

# Installation

Balda ships as a **single package**, `balda`. It gives you the HTTP server, multi‑runtime layer, decorators, validator/serializer, base plugins, CLI and every feature (MQTT, cron, queues, storage, mailer, GraphQL, cache) in one import. The third‑party drivers each feature relies on are **optional peer dependencies** — install only the ones for the feature(s) you actually use.

## Prerequisites

- **Node.js**: 18 or higher
- **Bun**: 1.0 or higher
- **Deno**: 1.40 or higher
- **TypeScript**: 5.0 or higher (recommended)

## 1. Install balda

```bash
# npm
npm install balda

# yarn
yarn add balda

# pnpm
pnpm add balda

# bun
bun add balda
```

For Deno, map the package in `deno.json`:

```json
{
  "imports": {
    "balda": "npm:balda",
    "bullmq": "npm:bullmq"
  }
}
```

## 2. Install only the driver(s) for the feature(s) you use

Every feature lists its drivers as **optional peer dependencies** and loads them lazily at runtime. You only need the driver for the provider you actually use — e.g. if you only use BullMQ queues, install *just* `bullmq`.

```bash
# MQTT
npm install mqtt

# Cron
npm install node-cron
# cronstrue is only required if you enable the cron UI dashboard

# Queues — install only the provider(s) you use
npm install bullmq ioredis              # BullMQ provider
npm install @aws-sdk/client-sqs sqs-consumer  # SQS provider
npm install pg-boss pg                  # PGBoss provider

# Storage — install only the provider(s) you use
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner  # S3 (Node/Deno); Bun has native S3
npm install @aws-sdk/cloudfront-signer  # only for CloudFront signed URLs
npm install @azure/storage-blob         # Azure Blob provider

# Mailer
npm install nodemailer handlebars       # + one of handlebars / ejs / mustache / edge.js

# GraphQL
npm install @apollo/server graphql @graphql-tools/schema

# Cache
npm install ioredis                     # only for the Redis cache provider
```

:::note
On **Bun**, the S3 storage provider uses Bun's native `Bun.S3Client` and does **not** require `@aws-sdk/client-s3` for puts/gets/presigned URLs. `@aws-sdk/client-s3` is still needed on Bun only for `listObjects` and CloudFront signing.
:::

## TypeScript setup

Balda is TypeScript‑first. Recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Verify installation

```typescript
// test-installation.ts
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.router.get("/", (_req, res) => {
  res.json({ message: "Balda is working!" });
});

server.listen(() => console.log("Server running on http://localhost:3000"));
```

```bash
npx tsx test-installation.ts   # Node.js
bun test-installation.ts       # Bun
deno run --allow-net test-installation.ts  # Deno
```

## Import convention

Everything is imported from `balda`:

```ts
import {
  Server,
  router,
  controller,
  get,
  post,
  cache,          // @cache() route decorator
  bullmqQueue,    // queue factory
  QueueService,
  cron,           // cron factory / @cron decorator
  CronService,
  mqtt,           // mqtt factory / @mqtt.subscribe decorator
  MqttService,
  Storage,
  S3StorageProvider,
  Mailer,
  HandlebarsAdapter,
  GraphQL,
  initCacheService,
} from "balda";
```

See the [Packages reference](./packages) for the full export map grouped by feature.

## Next Steps

- [Quick Start](./quick-start) — build your first API
- [Packages](./packages) — the full list of exports grouped by feature