---
title: Queue Providers
description: Configure BullMQ, AWS SQS, and PGBoss providers. Connection settings and provider-specific options.
keywords: [balda, queues, providers, bullmq, sqs, pgboss, redis]
sidebar_position: 3
---

### Providers

- Balda Queue supports the following providers out of the box:
  - BullMQ
  - SQS
  - PgBoss

- You must also install the corresponding package for each provider:
  - BullMQ: `npm install bullmq ioredis`
  - SQS: `npm install @aws-sdk/client-sqs sqs-consumer`
  - PgBoss: `npm install pg-boss pg`

- It's also possible to support custom providers via the `GenericPubSub` interface.

#### Single entrypoint configuration

Use `defineQueueConfiguration` to configure all providers in one place during app bootstrap:

```ts
import { defineQueueConfiguration } from "balda";

defineQueueConfiguration({
  bullmq: {
    connection: {
      host: "127.0.0.1",
      username: "default",
      password: "root",
      db: 0,
    },
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
  },
  sqs: {
    client: { region: "us-east-1" },
    consumer: {
      queueUrlMap: {
        test: "http://localhost:9324/queue/balda-development-test",
      },
      batchSize: 10,
    },
  },
  pgboss: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

#### Best Practice: Centralized Queue Registry

While not enforced, we recommend creating a centralized registry for all your queues. This provides a single source of truth and makes queue instances easily accessible throughout your application:

```ts
// src/queues/index.ts
import { bullmqQueue, sqsQueue, pgbossQueue } from "balda";

// Payload type definitions
type EmailPayload = { to: string; subject: string; body: string };
type OrderPayload = { orderId: number; total: number };
type NotificationPayload = { userId: string; message: string };

// Centralized queue registry
export const queues = {
  // BullMQ queues
  emails: bullmqQueue<EmailPayload>("emails"),

  // SQS queues
  orders: sqsQueue<OrderPayload>("orders", {
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/orders",
  }),

  // PGBoss queues
  notifications: pgbossQueue<NotificationPayload>("notifications"),
} as const;
```

Then use throughout your application:

```ts
import { queues } from "./queues/index.js";

// In handlers
export class EmailHandler {
  @queues.emails.subscribe()
  async handle(payload: EmailPayload) {
    // Send email
  }
}

// In services
await queues.emails.publish({
  to: "user@example.com",
  subject: "Welcome",
  body: "Hello!",
});
```

#### BullMQ

Create a typed BullMQ queue and subscribe to it using either decorators or callbacks:

```ts
import { bullmqQueue } from "balda";

type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

// Create queue instance
export const emailQueue = bullmqQueue<EmailPayload>("emails");

// Subscribe with decorator (recommended for class methods)
export class EmailHandler {
  @emailQueue.subscribe()
  async handle(payload: EmailPayload) {
    console.log(`Sending email to ${payload.to}`);
  }
}

// Or subscribe with callback (recommended for standalone functions)
await emailQueue.subscribe(async (payload) => {
  console.log(`Sending email to ${payload.to}`);
});

// Publish
await emailQueue.publish({
  to: "user@example.com",
  subject: "Hello",
  body: "World",
});
```

#### SQS

Create a typed SQS queue with queue URL and subscribe using either method:

```ts
import { sqsQueue } from "balda";

type OrderPayload = {
  orderId: number;
  total: number;
};

// Create queue instance with SQS options
export const orderQueue = sqsQueue<OrderPayload>("orders", {
  queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
});

// Subscribe with decorator
export class OrderHandler {
  @orderQueue.subscribe()
  async handle(payload: OrderPayload) {
    console.log(`Processing order ${payload.orderId}`);
  }
}

// Or subscribe with callback
await orderQueue.subscribe(async (payload) => {
  console.log(`Processing order ${payload.orderId}`);
});

// Publish with SQS-specific options
await orderQueue.publish(
  { orderId: 123, total: 99.99 },
  {
    MessageGroupId: "orders",
    DelaySeconds: 10,
  },
);
```

Note: You can either specify `queueUrl` per queue instance (as shown above) or configure it globally in `defineQueueConfiguration` with `queueUrlMap`.

#### PGBoss

Create a typed PGBoss queue and subscribe using either method:

```ts
import { pgbossQueue } from "balda";

type NotificationPayload = {
  userId: string;
  message: string;
};

// Create queue instance
export const notificationQueue =
  pgbossQueue<NotificationPayload>("notifications");

// Subscribe with decorator
export class NotificationHandler {
  @notificationQueue.subscribe()
  async handle(payload: NotificationPayload) {
    console.log(`Notifying user ${payload.userId}: ${payload.message}`);
  }
}

// Or subscribe with callback
await notificationQueue.subscribe(async (payload) => {
  console.log(`Notifying user ${payload.userId}: ${payload.message}`);
});

// Publish with PGBoss options
await notificationQueue.publish(
  { userId: "123", message: "Hello!" },
  {
    retryLimit: 3,
    retryDelay: 60,
  },
);
```

Note: PgBoss automatically creates queues when needed. Ensure your PostgreSQL database is accessible and the `pg-boss` package is installed.

#### Custom provider

Implement the `GenericPubSub` interface and create a typed queue using `createQueue`:

```ts
import { createQueue, GenericPubSub } from "balda";

type CustomPayload = {
  data: string;
};

// Implement custom PubSub
class MyCustomPubSub implements GenericPubSub<CustomPayload> {
  async publish(
    topic: string,
    payload: CustomPayload,
  ): Promise<{ id: string }> {
    // Custom publish logic
    console.log("Publishing to", topic, payload);
    return { id: "custom-id-1" };
  }

  async subscribe(
    topic: string,
    handler: (payload: CustomPayload) => Promise<void>,
  ): Promise<void> {
    // Wire your consumer and call handler(payload)
    console.log("Subscribed to", topic);
  }
}

// Create typed queue with custom provider
export const customQueue = createQueue<CustomPayload>(
  "custom-topic",
  new MyCustomPubSub(),
);

// Subscribe with decorator
export class CustomHandler {
  @customQueue.subscribe()
  async handle(payload: CustomPayload) {
    console.log("Received:", payload.data);
  }
}

// Or subscribe with callback
await customQueue.subscribe(async (payload) => {
  console.log("Received:", payload.data);
});

// Publish
await customQueue.publish({ data: "test" });
```

The custom provider approach gives you full control over the queue implementation while maintaining type safety and a consistent API.
