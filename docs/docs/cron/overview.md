---
title: Cron Jobs Overview
description: Schedule background tasks with the @cron decorator. Node-cron integration for recurring jobs.
keywords: [balda, cron, scheduled jobs, background, tasks, node-cron]
sidebar_position: 6
---

# Overview

Balda provides a **cron job decorator** that lets you schedule background tasks directly from your controllers or services.
This feature is available **only in Node.js compatible environments**.

:::tip Prefer the programmatic API for new code
The [`cron()` builder](./programmatic) schedules jobs without decorators or glob imports and returns a handle you can start, stop and destroy.
:::

> **Peer dependency** — Balda intentionally leaves the scheduling engine to the community-standard [`node-cron`](https://www.npmjs.com/package/node-cron). To enable cron support you must install it yourself:
>
> ```bash
> # with npm
> npm install node-cron
>
> # or with yarn / pnpm / bun
> yarn add node-cron
> pnpm add node-cron
> bun add node-cron
> ```

## Basic Usage

```typescript
import { cron } from "balda";

class TickCron {
  // Run every minute
  @cron("* * * * *")
  async handle() {
    console.log("Cron executed!");
  }
}
```

The decorator accepts any valid [cron expression](https://crontab.guru/) supported by `node-cron`.

## Advanced Options

You can pass an **options object** as the second argument to control timezone, concurrency, etc.

```typescript
@cron('0 0 * * *', { timezone: 'UTC' })
async handle() {
  await this.cleanupService.run();
}
```

## Error Handling

By default, if the decorated method throws, Balda will log the error (using the configured logger) but will **not** crash your server.

You can set a global cron error handler to handle the errors:

```typescript
import { setCronGlobalErrorHandler } from "balda";

setCronGlobalErrorHandler((context) => {
  console.error(context.execution?.error);
  // Send to Sentry, log to file, etc.
});
```

## Starting Cron Jobs

You can import registered cron jobs classes that have one or more `@cron` decorated methods or directly import the `@cron` decorator and use it to decorate your own methods. For the recommended, decorator-free approach see the [Programmatic API](./programmatic).

### Option 1: With glob patterns (recommended)

```typescript
import { CronService } from "balda";

// Import all cron jobs from patterns
await CronService.massiveImportCronJobs(["src/cron/**/*.{ts,js}"]);

// Start the cron scheduler
await CronService.run();

console.log("Cron jobs started");
```

### Option 2: Manual import

```typescript
import { CronService } from "balda";
import "./cron/specific_cron_job.js";

// Start the cron scheduler
await CronService.run();
```
