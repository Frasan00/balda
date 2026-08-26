---
title: init-queue
description: Initialize queue provider configuration with BullMQ, SQS, or PG-Boss. Installs required dependencies.
keywords: [balda, init queue, bullmq, sqs, pg-boss, background jobs]
sidebar_position: 2
---

# init-queue

Initialize queue provider configuration with required dependencies.

```bash
npx balda init-queue -t bullmq
npx balda init-queue -t sqs -o src/queue
```

## Flags

- `-t, --type <provider>`: Queue provider (`bullmq`, `sqs`, `pgboss`) - **required**
- `-o, --output <path>`: Output directory (default `src/queue`)

## Provider Dependencies

- **BullMQ**: `bullmq`, `ioredis`
- **SQS**: `@aws-sdk/client-sqs`, `sqs-consumer`
- **PG-Boss**: `pg-boss`, `pg`

## What it does

1. Checks if dependencies are installed (skips if present)
2. Installs required packages for the provider
3. Creates configuration file with environment templates

:::tip
Use `npx balda generate-queue` to create queue worker handlers after initialization.
:::
