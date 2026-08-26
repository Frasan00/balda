---
title: generate-cron
description: Generate a new cron job file for scheduled task execution in Balda.
keywords: [balda, generate cron, scheduled, task, job, cron]
sidebar_position: 8
---

# generate-cron

Generate a new cron job for scheduled tasks.

```bash
npx balda generate-cron clean-sessions -p src/maintenance/cron
```

**Generated file:** `src/maintenance/cron/clean-sessions.ts`

## Flags

- `-p, --path <string>`: Target directory (default `src/cron`)
