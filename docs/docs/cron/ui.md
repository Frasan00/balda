---
title: Cron UI Dashboard
description: Built-in web dashboard to visualize and monitor scheduled cron jobs. Filterable interface with human-readable schedules.
keywords: [balda, cron, ui, dashboard, monitor, scheduled]
sidebar_position: 7
---

# Cron UI

Balda provides a **built-in web dashboard** to visualize and monitor your scheduled cron jobs. This feature helps you quickly see all registered cron jobs, their schedules, frequencies, and timezones in a modern, filterable interface.

> **Peer dependency** — The Cron UI requires [`cronstrue`](https://www.npmjs.com/package/cronstrue) to convert cron expressions into human-readable descriptions. To enable the UI, you must install it:
>
> ```bash
> # with npm
> npm install cronstrue
>
> # or with yarn / pnpm / bun
> yarn add cronstrue
> pnpm add cronstrue
> bun add cronstrue
> ```

## Basic Setup

Enable the Cron UI by calling `cronUi()` directly before or after your server starts:

```typescript
import { Server } from "balda";
import { cronUi } from "balda";

const server = new Server({
  port: 3000,
});

// Register the Cron UI dashboard as a standalone service
await cronUi({ path: "/cron-dashboard" });

await server.listen();
```

Once enabled, navigate to `http://localhost:3000/cron-dashboard` to view your cron jobs dashboard.

## Features

The Cron UI dashboard provides:

- **Job Overview**: Display all registered cron jobs with their names and schedules
- **Human-Readable Schedules**: Automatic conversion of cron expressions (e.g., `0 0 * * *` → "At 12:00 AM")
- **Search**: Filter jobs by name in real-time
- **Frequency Filter**: Filter jobs by their execution frequency
- **Timezone Filter**: Filter jobs by their configured timezone
- **Live Counter**: Shows total jobs and currently visible jobs after filtering
- **Modern UI**: Dark-themed, responsive interface with smooth animations

## Configuration Options

### CronUIOptions

| Option | Type     | Required | Description                                           |
| ------ | -------- | -------- | ----------------------------------------------------- |
| `path` | `string` | Yes      | The route path where the dashboard will be accessible |

## Example

Here's a complete example with multiple cron jobs:

```typescript
import { Server } from "balda";
import { cron, CronService, cronUi } from "balda";

// Define your cron jobs
class BackupCron {
  @cron("0 2 * * *", { timezone: "UTC" })
  async dailyBackup() {
    console.log("Running daily backup at 2 AM UTC");
    // Backup logic here
  }
}

class NotificationCron {
  @cron("*/5 * * * *")
  async checkNotifications() {
    console.log("Checking notifications every 5 minutes");
    // Notification logic here
  }
}

class ReportCron {
  @cron("0 9 * * 1", { timezone: "America/New_York" })
  async weeklyReport() {
    console.log("Generating weekly report every Monday at 9 AM EST");
    // Report logic here
  }
}

// Start the server with Cron UI
const server = new Server({
  port: 3000,
});

// Import and start cron jobs
await CronService.massiveImportCronJobs(["src/cron/**/*.{ts,js}"]);
await CronService.run();

// Register the Cron UI dashboard
await cronUi({ path: "/cron-dashboard" });

await server.listen();

console.log("Server running on http://localhost:3000");
console.log("Cron Dashboard available at http://localhost:3000/cron-dashboard");
```

## Security Considerations

:::caution
The Cron UI is publicly accessible by default. In production environments, you should protect this route with authentication middleware.
:::

### Protecting the Dashboard

Use middleware to add authentication to the Cron UI route:

```typescript
import { Server, middleware } from "balda";
import { cronUi } from "balda";

// Define authentication middleware
class AuthMiddleware {
  @middleware()
  async checkAuth(req, res, next) {
    const apiKey = req.rawHeaders.get("x-api-key");

    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  }
}

// Apply to server
const server = new Server({
  port: 3000,
});

// Register the Cron UI dashboard
await cronUi({ path: "/cron-dashboard" });

// You can add authentication by using a global middleware
// or by defining a custom route handler for your dashboard
```

Alternatively, you can disable the built-in UI in production and build your own protected endpoint:

```typescript
import { cronUIInstance } from "balda";
import { Router } from "express";

const router = Router();

router.get("/admin/cron", authenticateAdmin, async (req, res) => {
  const html = await cronUIInstance.generate();
  res.send(html);
});
```

## Troubleshooting

### Dashboard shows "No cron jobs configured"

This happens when:

- No cron jobs have been registered with `@cron` decorator
- Cron jobs haven't been imported before the server starts
- Cron jobs are defined but `CronService.run()` hasn't been called

**Solution**: Make sure to import your cron jobs and call `CronService.run()`:

```typescript
await CronService.massiveImportCronJobs(["src/cron/**/*.{ts,js}"]);
await CronService.run();
```

### Error: "cronstrue not installed as a dependency"

The Cron UI requires `cronstrue` to convert cron expressions to human-readable text.

**Solution**: Install the peer dependency:

```bash
npm install cronstrue
```

### Cron UI path conflicts with existing route

If you have an existing route that conflicts with the Cron UI path, you'll need to choose a different path.

**Solution**: Use a unique path for the dashboard:

```typescript
await cronUi({ path: "/admin/cron-jobs" });
```

## API Reference

### `cronUi(options: CronUIOptions)`

Registers the Cron UI dashboard route.

**Parameters:**

- `options: CronUIOptions` - Configuration object with the following properties:
  - `path: string` - The route path where the dashboard will be accessible (required)

**Returns:** `Promise<void>`

**Throws:**

- `BaldaError` if `path` is not provided or is empty

**Example:**

```typescript
import { cronUi } from "balda";

// Manually register the Cron UI
await cronUi({
  path: "/cron-dashboard",
});
```

### `cronUIInstance.generate()`

Generates the HTML for the Cron UI dashboard. This is useful if you want to create a custom route with authentication.

**Returns:** `Promise<string>` - HTML string of the dashboard

**Example:**

```typescript
import { cronUIInstance } from "balda";

const html = await cronUIInstance.generate();
// Use the HTML string as needed
```

## Related

- [Cron Overview](./overview.md) - Learn about the `@cron` decorator
- [Error Handling](./overview.md#error-handling) - Handle cron job errors
- [Starting Cron Jobs](./overview.md#starting-cron-jobs) - Import and start cron jobs
