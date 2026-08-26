---
title: Queues Overview
description: Provider-agnostic queue abstraction for background jobs. BullMQ, SQS, PGBoss support with type-safe API.
keywords: [balda, queues, background jobs, bullmq, sqs, pgboss]
sidebar_position: 1
---

### Queues Overview

Balda provides a lightweight, provider-agnostic queue abstraction to publish and consume background jobs with a clean, type‑safe API. It ships with first‑class providers for BullMQ, AWS SQS, and PGBoss, and allows custom providers. Install only the driver for the provider you use (e.g. `pnpm add bullmq`).

:::tip Prefer the programmatic API for new code
The [Programmatic API](./programmatic) consumes jobs with plain callback handlers and returns handles you can `unsubscribe()` from, without decorators or glob imports.
:::

- **Typed queue instances**: Create fully typed queue instances with factory functions
- **Decorator-based consumers**: Use `@queueInstance.subscribe()` decorators to subscribe class methods
- **Callback-based consumers**: Subscribe using callback functions for simpler use cases
- **Type safety**: Full TypeScript support with generic payload types
- **Simple publishing**: Call `queueInstance.publish(payload)` on typed queue instances

#### Core building blocks

- Factory functions: `bullmqQueue`, `sqsQueue`, `pgbossQueue`, `createQueue` (for custom providers)
- `TypedQueue` and `CustomTypedQueue` classes for type-safe queue operations
- `defineQueueConfiguration` single entrypoint to configure built-in providers
- `QueueService` to manage and start all queue subscribers

#### Best Practice: Centralized Queue Registry

While not enforced, the recommended approach is to define all your queues in a centralized location. This provides a single source of truth and makes queues easily importable across your application:

```ts
// src/queues/index.ts
import { bullmqQueue, sqsQueue, pgbossQueue } from "balda";

// Define payload types
type UserEventPayload = { userId: string; action: string };
type EmailPayload = { to: string; subject: string; body: string };
type NotificationPayload = { userId: string; message: string };

// Export all queues from a single location
export const queues = {
  userEvents: bullmqQueue<UserEventPayload>("user-events"),
  emails: sqsQueue<EmailPayload>("emails", {
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/emails",
  }),
  notifications: pgbossQueue<NotificationPayload>("notifications"),
} as const;
```

Then import queues wherever needed:

```ts
import { queues } from './queues/index.js';

// In handlers
@queues.userEvents.subscribe()
async handle(payload: UserEventPayload) { }

// In services
await queues.userEvents.publish({ userId: '123', action: 'signup' });
```

This pattern is optional but highly recommended for larger applications with multiple queues.

#### Quick start

1. Create a typed queue instance:

```ts
import { bullmqQueue } from "balda";

// Define payload type
type UserEventPayload = {
  userId: string;
  action: string;
};

// Create typed queue
export const userQueue = bullmqQueue<UserEventPayload>("user-events");
```

2. Subscribe to queues (two ways):

**Option A: Decorator-based subscription (recommended for class methods)**

```ts
export class UserEventHandler {
  @userQueue.subscribe()
  async handle(payload: UserEventPayload) {
    // process job with full type safety
    console.log(`User ${payload.userId} performed ${payload.action}`);
  }
}
```

**Option B: Callback-based subscription (for standalone functions)**

```ts
await userQueue.subscribe(async (payload) => {
  console.log(`User ${payload.userId} performed ${payload.action}`);
});
```

3. Configure and start subscribers:

```ts
import { QueueService, defineQueueConfiguration } from "balda";

// Configure queue providers
defineQueueConfiguration({
  bullmq: {
    connection: {
      host: "127.0.0.1",
      username: "default",
      password: "root",
      db: 0,
    },
  },
});

// Import handlers (this registers decorators)
import "./handlers/user-events.js";

// Start queue subscribers
await QueueService.run();

console.log("Queues started");

// Publish a job
await userQueue.publish({ userId: "123", action: "signup" });
```

#### Subscription Methods

Each queue instance provides two ways to subscribe:

**1. Decorator-based (best for organized class handlers)**

```ts
import { bullmqQueue } from "balda";

const orderQueue = bullmqQueue<{ orderId: number }>("orders");

export class OrderHandler {
  @orderQueue.subscribe()
  async handle(payload: { orderId: number }) {
    console.log("Processing order:", payload.orderId);
  }
}
```

**2. Callback-based (best for simple inline handlers)**

```ts
import { bullmqQueue } from "balda";

const orderQueue = bullmqQueue<{ orderId: number }>("orders");

// Subscribe with callback
await orderQueue.subscribe(async (payload) => {
  console.log("Processing order:", payload.orderId);
});
```

Both methods are fully type-safe and provide the same functionality. Choose the approach that best fits your code organization style.

#### Alternative: Glob-based handler imports

```ts
// queue.ts
import { QueueService } from "balda";
import path from "node:path";

// Import all handler files
await QueueService.massiveImportQueues([
  path.join(import.meta.dirname, "src/queues/**/*.ts"),
]);

// Start all subscribers
await QueueService.run();
```

Continue with configuration and publishing details in the next sections.
