---
title: Cron Programmatic API
description: Schedule recurring jobs with the cron() builder, without decorators or glob imports.
keywords: [balda, cron, scheduled jobs, background, programmatic, node-cron]
sidebar_position: 2
---

# Programmatic API

The `cron()` factory lets you schedule recurring jobs without decorators, throwaway classes or `massiveImport*` glob imports. It returns a handle you can `start`, `stop` and `destroy` directly.

> **Prefer the programmatic API for new code.** The [`@cron` decorator](./overview) remains fully supported and is useful when you want a class-based cron job with a scoped logger.

## Usage

```typescript
import { cron } from "balda";

const cleanup = cron("*/2 * * * *", {
  name: "cleanup",
  timezone: "Europe/Rome",
});

await cleanup.start(() => {
  console.log("Cleaning up...");
});

// Later, stop the job
cleanup.stop();
```

## The handle

`cron()` returns a `CronHandle` with:

| Method     | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| `name`     | The unique job name (used for identification and the [cron UI](./ui)).        |
| `start(fn)`| Schedules the job with the given handler. Throws if already started.          |
| `stop()`   | Pauses the job. It can be restarted with `start()`.                           |
| `destroy()`| Stops the job and releases its resources.                                     |

```typescript
const job = cron("* * * * *", { name: "metrics" });

await job.start(async () => {
  await collectMetrics();
});

job.stop();      // pause
await job.start(collectMetrics); // resume
job.destroy();   // fully release
```

## Options

```typescript
import { cron } from "balda";

const job = cron("0 0 * * *", {
  name: "nightly-sync",
  timezone: "UTC",
  onFailed: (context) => {
    console.error("Sync failed", context.execution?.error);
  },
});
```

- `name` — **required** when used programmatically. Uniquely identifies the job.
- `timezone` — IANA timezone the schedule is expressed in.
- `onFailed` — per-job error handler. Falls back to the global handler when omitted.

## Works as a decorator too

`cron()` doubles as the `@cron` decorator. The name is derived from the class and method when not supplied:

```typescript
class Cleanup {
  @cron("0 0 * * *", { name: "cleanup" })
  run() {
    console.log("Cleaning up...");
  }
}
```

## Bootstrap with the Server

When using the [`Server`](../core-concepts/server), you can wire cron jobs through the `background` option so they start automatically on `listen()`:

```typescript
import { Server } from "balda";

const server = new Server({
  background: {
    crons: [
      {
        schedule: "*/10 * * * *",
        options: { name: "heartbeat" },
        handler: () => console.log("alive"),
      },
    ],
  },
});
```

This is an explicit alternative to `CronService.massiveImportCronJobs()` + `CronService.run()`.
