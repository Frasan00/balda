---
title: Decorators vs Programmatic API
description: Understand the two API styles available in Balda and when to use each.
keywords: [balda, api styles, decorators, programmatic, functional]
sidebar_position: 3
---

# API Styles

Balda exposes two complementary API styles for most features: a **decorator-based** (class) style and a **programmatic** (functional) style. You can mix them freely in the same application.

## The two styles

| Style           | HTTP routing                  | Queues             | Crons                | MQTT                 |
| --------------- | ----------------------------- | ------------------ | -------------------- | -------------------- |
| **Decorator**   | `@controller` + `@get` etc.   | `@queue.subscribe()`| `@cron(...)`         | `@mqtt.subscribe()`  |
| **Programmatic**| `router.get()` etc.           | `queue.subscribe(fn)` | `cron(...).start(fn)` | `mqtt.subscribe(topic, fn)` |

Both styles register into the same underlying services and can be used together.

## When to use the decorator style

- You want **class-based organization** and a scoped logger (`BaseMqtt`, `BaseCron`, `BaseController`).
- You rely on **auto-discovery** via the `massiveImport*` helpers (`controllerPatterns`, `QueueService.massiveImportQueues`, etc.).
- You prefer colocating handlers with dependency-injected services on a class.

## When to use the programmatic style

- You want **explicit, discoverable registration** without glob imports.
- You have **standalone functions** or prefer a functional/composition style.
- You need a **handle** to start, stop or unsubscribe at runtime (e.g. `cron(...).stop()`, `handle.unsubscribe()`).
- You prefer the **functional `router`** for HTTP routes (the modern, non-deprecated way).

## Recommendations

- **HTTP routing**: use the functional [`router`](../core-concepts/routing). The `@controller`/`@get` decorators are deprecated.
- **Crons, Queues, MQTT**: prefer the programmatic API for new code; decorators remain fully supported.
- You can mix styles — e.g. define queues with the factory and register some consumers with decorators and others with callbacks.

## The shared `background` bootstrap

Instead of glob imports, you can wire cron jobs, MQTT subscriptions and queue subscribers directly on the [`Server`](../core-concepts/server) via the `background` option:

```typescript
import { Server } from "balda";

const server = new Server({
  background: {
    crons: [{ schedule: "* * * * *", options: { name: "ping" }, handler: ping }],
    mqtt: { connect: { host: "localhost", port: 1883 }, subscribe: [...] },
    queues: { config: { bullmq: { connection: { host: "localhost" } } }, run: true },
  },
});
```

See the [Cron](./../cron/programmatic), [Queues](./../queues/programmatic) and [MQTT](./../mqtt/programmatic) programmatic pages for details.
