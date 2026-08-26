---
title: Queues Programmatic API
description: Consume queue jobs with callback handlers and explicit handles, without decorators or glob imports.
keywords: [balda, queues, background jobs, programmatic, bullmq, sqs, pgboss]
sidebar_position: 2
---

# Programmatic API

Queue consumers can be registered with plain callback functions instead of the `@queue.subscribe()` decorator. The callback form returns a handle with an `id`, the `topic` and an `unsubscribe()` method.

> **Prefer the programmatic API for new code.** The `@queue.subscribe()` decorator form remains supported for class-based handlers.

## Consume with a callback

```typescript
import { bullmqQueue } from "balda";

const userQueue = bullmqQueue<{ userId: string; action: string }>("user-events");

const handle = await userQueue.subscribe(async (payload) => {
  console.log(`User ${payload.userId} performed ${payload.action}`);
});

// Later, stop consuming
await handle.unsubscribe();
```

The returned handle exposes:

| Property       | Description                                          |
| -------------- | ---------------------------------------------------- |
| `id`           | Unique identifier of this subscription.              |
| `topic`        | The queue topic this handle is subscribed to.        |
| `unsubscribe()`| Stop consuming from the queue.                       |

## Publishing

Publishing is unchanged and fully type-safe:

```typescript
await userQueue.publish({ userId: "123", action: "signup" });
```

## The decorator form stays explicit

Use `subscribeMethod()` when you want a decorator on a class method — it makes the intent clear and avoids the overloaded `subscribe()` ambiguity:

```typescript
import { bullmqQueue } from "balda";

const orderQueue = bullmqQueue<{ orderId: number }>("orders");

export class OrderHandler {
  @orderQueue.subscribeMethod()
  async handle(payload: { orderId: number }) {
    console.log("Processing order:", payload.orderId);
  }
}
```

> **Note** — `@queue.subscribe()` (no arguments) still works as a decorator and is an alias of `subscribeMethod()`, but it is deprecated in favor of the clearer method names.

## Custom providers

The `createQueue` factory returns a `CustomTypedQueue` with the same programmatic `subscribe(handler)` API:

```typescript
import { createQueue } from "balda";
import { CustomPubSub } from "./pubsub.js";

const queue = createQueue<{ id: number }>("jobs", new CustomPubSub());

await queue.subscribe(async (payload) => {
  console.log(payload.id);
});
```

## Bootstrap with the Server

Configure providers and run subscribers automatically when the server starts, via the `background` option:

```typescript
import { Server } from "balda";
import { queues } from "./queues/index.js";

const server = new Server({
  background: {
    queues: {
      config: {
        bullmq: {
          connection: { host: "127.0.0.1", port: 6379 },
        },
      },
      run: true,
    },
  },
});

// Register callback consumers before listen()
await queues.emails.subscribe(async (payload) => {
  await sendEmail(payload);
});
```

This is an explicit alternative to `QueueService.massiveImportQueues()` + `QueueService.run()`.
