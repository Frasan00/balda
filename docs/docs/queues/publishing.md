---
title: Publishing Jobs
description: Publish background jobs with typed queue instances. Type-safe payloads and centralized queue registry.
keywords: [balda, queues, publish, jobs, background]
sidebar_position: 2
---

### Publishing

Use typed queue instances to publish jobs with full type safety. Each queue instance has a `publish` method that accepts the payload and optional provider-specific options.

#### Best Practice: Centralized Queue Registry

**Recommended (but not enforced):** Define all queues in a centralized location for better organization and reusability:

```ts
// src/queues/registry.ts
import { bullmqQueue, sqsQueue, pgbossQueue } from "balda";

// Define payload types
type UserEvent = { userId: string; action: string };
type EmailJob = { to: string; subject: string; body: string };
type NotificationJob = { userId: string; message: string };

// Export all queues from a single registry
export const queues = {
  userEvents: bullmqQueue<UserEvent>("user-events"),
  emails: sqsQueue<EmailJob>("emails", {
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/emails",
  }),
  notifications: pgbossQueue<NotificationJob>("notifications"),
} as const;
```

**Benefits:**

- Single source of truth for all queues
- Easy to import: `import { queues } from './queues/registry.js'`
- Consistent queue configuration across the application
- Better discoverability of available queues

**Usage:**

```ts
import { queues } from "./queues/registry.js";

// Publishing
await queues.userEvents.publish({ userId: "123", action: "signup" });
await queues.emails.publish({
  to: "user@example.com",
  subject: "Welcome",
  body: "Hello!",
});

// Subscribing
export class UserEventHandler {
  @queues.userEvents.subscribe()
  async handle(payload: UserEvent) {
    console.log(`User ${payload.userId} performed ${payload.action}`);
  }
}
```

This pattern is completely optional - you can also define queues inline or in separate files based on your preference.

#### Creating typed queues

Alternatively, create typed queue instances directly where needed using factory functions:

```ts
import { bullmqQueue, sqsQueue, pgbossQueue } from "balda";

// Define payload types
type UserEvent = { userId: string; action: string };
type EmailJob = { to: string; subject: string; body: string };
type NotificationJob = { userId: string; message: string };

// Create queue instances
export const userQueue = bullmqQueue<UserEvent>("user-events");
export const emailQueue = sqsQueue<EmailJob>("emails", {
  queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/emails",
});
export const notificationQueue = pgbossQueue<NotificationJob>("notifications");
```

#### Basic publishing

```ts
// Publish to BullMQ
await userQueue.publish({ userId: "123", action: "signup" });

// Publish to SQS
await emailQueue.publish({
  to: "user@example.com",
  subject: "Welcome",
  body: "Thanks for signing up!",
});

// Publish to PGBoss
await notificationQueue.publish({
  userId: "123",
  message: "Your order has shipped",
});
```

#### Publishing with provider options

Each provider supports specific options as the second parameter:

**BullMQ options** (maps to `Queue.add` third parameter):

```ts
await userQueue.publish(
  { userId: "123", action: "signup" },
  {
    delay: 5000, // Delay 5 seconds
    priority: 1, // High priority
    removeOnComplete: true, // Auto-remove on completion
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
);
```

**SQS options**:

```ts
await emailQueue.publish(
  { to: "user@example.com", subject: "Hello", body: "World" },
  {
    MessageGroupId: "emails", // For FIFO queues
    MessageDeduplicationId: "123", // For FIFO queues
    DelaySeconds: 10, // Delay 10 seconds
    MessageAttributes: {
      // Custom attributes
      priority: {
        DataType: "String",
        StringValue: "high",
      },
    },
  },
);
```

**PGBoss options** (maps to `send` third parameter):

```ts
await notificationQueue.publish(
  { userId: "123", message: "Hello!" },
  {
    retryLimit: 3, // Retry up to 3 times
    retryDelay: 60, // Wait 60 seconds between retries
    expireInSeconds: 3600, // Expire after 1 hour
    priority: 10, // Higher number = higher priority
  },
);
```

#### Subscribing to queues

The `subscribe` method supports two patterns:

**1. Decorator-based subscription (recommended for class methods):**

```ts
export class UserEventHandler {
  @userQueue.subscribe()
  async handle(payload: UserEvent) {
    console.log(`User ${payload.userId} performed ${payload.action}`);
  }
}
```

**2. Callback-based subscription (recommended for standalone functions):**

```ts
await userQueue.subscribe(async (payload) => {
  console.log(`User ${payload.userId} performed ${payload.action}`);
});
```

**Key differences:**

- **Decorators** are ideal for organized class-based handlers and work seamlessly with dependency injection patterns
- **Callbacks** are perfect for simple handlers, scripts, or when you prefer a functional programming style
- Both methods provide full type safety and identical runtime behavior
- You can mix both approaches in the same application

#### Type safety benefits

The typed queue API provides full type safety:

```ts
// ✅ Type-safe: correct payload
await userQueue.publish({ userId: '123', action: 'signup' });

// ❌ TypeScript error: missing required fields
await userQueue.publish({ userId: '123' });

// ❌ TypeScript error: wrong field type
await userQueue.publish({ userId: 123, action: 'signup' });

// ✅ Type-safe handler
@userQueue.subscribe()
async handle(payload: UserEvent) {
  // payload.userId is string
  // payload.action is string
  // Full autocomplete and type checking
}
```

#### Multiple queues with the same provider

You can create multiple queue instances for the same provider:

```ts
import { bullmqQueue } from 'balda';

// Different queues for different job types
export const emailQueue = bullmqQueue<EmailJob>('emails');
export const smsQueue = bullmqQueue<SMSJob>('sms');
export const pushQueue = bullmqQueue<PushJob>('push-notifications');

// Each has its own type-safe publish/subscribe
await emailQueue.publish({ to: 'user@example.com', ... });
await smsQueue.publish({ phone: '+1234567890', ... });
await pushQueue.publish({ deviceToken: 'abc123', ... });
```

#### Summary: Two ways to subscribe

Every typed queue instance (BullMQ, SQS, PGBoss, or custom) supports both subscription methods:

```ts
import { bullmqQueue, sqsQueue, pgbossQueue } from "balda";

const queue = bullmqQueue<MyPayload>("my-topic");

// Method 1: Decorator (for class methods)
class MyHandler {
  @queue.subscribe()
  async handle(payload: MyPayload) {}
}

// Method 2: Callback (for standalone functions)
await queue.subscribe(async (payload) => {});
```

Choose the method that best fits your application architecture. Both provide identical functionality and full TypeScript type safety.
