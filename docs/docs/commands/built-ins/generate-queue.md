---
title: generate-queue
description: Generate a new queue worker for background job processing with BullMQ, SQS, or PG-Boss.
keywords: [balda, generate queue, background jobs, worker, bullmq]
sidebar_position: 9
---

# generate-queue

Generate a new queue worker for background job processing.

```bash
npx balda generate-queue user-signup -p src/queues --provider bullmq
```

**Generated file:** `src/queues/user-signup.ts`

## Flags

- `-p, --path <string>`: Target directory (default `src/queues`)
- `--provider <string>`: Queue provider (`bullmq`, `pgboss`, `sqs`, or `custom`)
