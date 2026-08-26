---
title: queue-start
description: Start queue workers to process background jobs from BullMQ, SQS, or PG-Boss queues.
keywords: [balda, queue start, worker, background jobs, processing]
sidebar_position: 7
---

# queue-start

Start queue workers to process jobs from registered queues.

```bash
npx balda queue-start
npx balda queue-start src/queues/**/*.ts
```

## Arguments

- `pattern`: Glob pattern for queue handler files (default: `src/queues/**/*.{ts,js}`)

## Flags

- `-p, --patterns <patterns...>`: Additional glob patterns for queue handlers

## What it does

1. Loads queue handler files matching the provided patterns
2. Registers all handlers decorated with queue decorators (`@queue.subscribe()`)
3. Starts workers to process jobs from configured queue providers
4. Keeps the process alive to continuously process jobs

## Supported Queue Providers

- **BullMQ** (Redis-based)
- **SQS** (AWS Simple Queue Service)
- **PG-Boss** (PostgreSQL-based)
- **Memory** (In-memory, development only)
- **Custom** (Your own queue implementation)

## Examples

```bash
# Use default pattern (src/queues/**/*.{ts,js})
npx balda queue-start

# Custom pattern
npx balda queue-start app/jobs/**/*.ts

# Multiple patterns
npx balda queue-start src/queues/**/*.ts --patterns src/jobs/**/*.ts
```

## Queue Handler Example

```typescript
import { memoryQueue } from "balda";

type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

const emailQueue = memoryQueue<EmailPayload>("emails");

export class EmailQueueHandler {
  @emailQueue.subscribe()
  async handle(payload: EmailPayload) {
    console.log(`Sending email to ${payload.to}`);
    // Process email sending logic
  }
}
```

:::tip
Use this command in production to run dedicated queue worker processes. Separate your web servers from queue workers for better scalability.
:::

:::info
Initialize queue providers first with `npx balda init-queue` and create handlers with `npx balda generate-queue`.
:::
