---
title: cron-start
description: Start the cron job scheduler to run scheduled tasks. Uses node-cron for reliable job execution.
keywords: [balda, cron start, scheduled tasks, background jobs, node-cron]
sidebar_position: 8
---

# cron-start

Start the cron job scheduler to run scheduled tasks.

```bash
npx balda cron-start
npx balda cron-start src/crons/**/*.ts
```

## Arguments

- `pattern`: Glob pattern for cron job files (default: `src/crons/**/*.{ts,js}`)

## Flags

- `-p, --patterns <patterns...>`: Additional glob patterns for cron jobs

## What it does

1. Loads cron job files matching the provided patterns
2. Registers all jobs decorated with the `@cron` decorator
3. Starts the scheduler using `node-cron`
4. Keeps the process alive to execute jobs at scheduled times

## Cron Expression Format

Standard cron syntax (5 or 6 fields):

```
┌────────────── second (optional)
│ ┌──────────── minute (0-59)
│ │ ┌────────── hour (0-23)
│ │ │ ┌──────── day of month (1-31)
│ │ │ │ ┌────── month (1-12)
│ │ │ │ │ ┌──── day of week (0-7, 0|7 = Sunday)
│ │ │ │ │ │
* * * * * *
```

## Examples

```bash
# Use default pattern (src/crons/**/*.{ts,js})
npx balda cron-start

# Custom pattern
npx balda cron-start app/tasks/**/*.ts

# Multiple patterns
npx balda cron-start src/crons/**/*.ts --patterns src/schedules/**/*.ts
```

## Cron Job Example

```typescript
import { BaseCron } from "balda";
import { cron } from "balda";

export default class DailyReportCron extends BaseCron {
  @cron("0 0 * * *", { timezone: "America/New_York" })
  async handle() {
    this.logger.info("Generating daily report...");
    // Daily report generation logic
  }
}
```

### Common Cron Patterns

```typescript
"*/5 * * * *"; // Every 5 minutes
"0 */2 * * *"; // Every 2 hours
"0 0 * * *"; // Daily at midnight
"0 0 * * 0"; // Weekly on Sunday
"0 0 1 * *"; // Monthly on the 1st
"0 9 * * 1-5"; // Weekdays at 9 AM
```

## Configuration Options

```typescript
@cron('0 0 * * *', {
  timezone: 'America/New_York',  // Timezone for schedule
  runOnInit: false,               // Run immediately on start
})
```

:::tip
Run cron jobs in a separate process from your web servers. Use process managers like PM2 or systemd to keep the scheduler running.
:::

:::info
Generate cron jobs with `npx balda generate-cron` for proper structure and type safety.
:::
