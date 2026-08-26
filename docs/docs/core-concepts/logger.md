---
title: Logger
description: Structured logging with Pino for Node.js, Bun, and Deno. JSON output, log levels, and custom transports.
keywords: [balda, logger, logging, pino, structured logs, json]
sidebar_position: 7
---

# Logger

Balda provides built-in structured logging powered by [Pino](https://getpino.io/) - a fast, low-overhead logger for Node.js, Bun, and Deno.

## Overview

- **Library:** Pino ^10.1.0
- **Default level:** `info`
- **Format:** JSON (structured logs)
- **Runtimes:** Node.js, Bun, Deno

## Basic Usage

```typescript
import { logger } from "balda";

logger.info("Server starting");
logger.error("Something went wrong", { error: err });
logger.warn("High memory usage");
logger.debug("Debug information", { context: data });
```

## Custom Logger for the Server

Pass your own Pino logger instance directly to the `Server` constructor — just like you can with `ajvInstance`:

```typescript
import pino from "pino";
import { Server } from "balda";

const logger = pino({ level: "debug" });

const server = new Server({
  port: 3000,
  logger,
});
```

If no `logger` is provided, the server uses the default internal logger (`info` level, JSON output).

### Pretty-Printed Logs (Development)

```typescript
import pino from "pino";
import { Server } from "balda";

const logger = pino({
  level: "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
});

const server = new Server({ port: 3000, logger });
```

### JSON Logs (Production)

```typescript
import pino from "pino";
import { Server } from "balda";

const logger = pino({
  level: "warn",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const server = new Server({ port: 3000, logger });
```

### Environment-Based Configuration

```typescript
import pino from "pino";
import { Server } from "balda";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

const server = new Server({ port: 3000, logger });
```

## Scoped Loggers

Create child loggers with additional context using `logger.child()`:

```typescript
import { logger } from "balda";

const serviceLogger = logger.child({ scope: "UserService" });
serviceLogger.info("User created", { userId: "123" });

// Output: {"level":"info","time":...,"scope":"UserService","userId":"123","msg":"User created"}
```

### Scoped Logger Pattern in Classes

```typescript
import { logger } from "balda";

export class UserService {
  private readonly log = logger.child({ scope: "UserService" });

  async createUser(email: string) {
    this.log.info("Creating user", { email });
    // ...
  }
}
```

## CLI Logger Resolution

Commands run standalone via `npx balda <command>` — there is no user-controlled entrypoint. To use a custom logger for CLI commands, Balda resolves the logger automatically from a file path:

1. `CommandRegistry.loggerPath` defaults to `"src/logger.ts"` (configurable, like `commandsPattern`)
2. Before executing a command, the CLI dynamically imports the file and looks for a **named `logger` export** (a pino instance)
3. If found, it calls `CommandRegistry.setLogger()` internally — all commands use that logger
4. Per-command override is possible via `CommandOptions.loggerPath`

Since the scaffolded `src/logger.ts` exports a pino instance that is also imported by `server.ts`, **both the server and CLI commands share the same logger definition**.

### Default Behavior (zero config)

The `init` command scaffolds `src/logger.ts`:

```typescript
// src/logger.ts
import pino from "pino";

export const logger = pino({ level: "info" });
```

And `src/server.ts` imports it:

```typescript
import { Server } from "balda";
import { logger } from "./logger.js";

const server = new Server({
  port: 80,
  logger,
});
```

CLI commands automatically pick up the same logger from `src/logger.ts` — no extra configuration needed.

### Custom Logger Path

To change the global logger path for all commands:

```typescript
import { CommandRegistry } from "balda";

CommandRegistry.loggerPath = "src/custom-logger.ts";
```

Or override per-command:

```typescript
import { Command, CommandOptions } from "balda";

export default class MyCommand extends Command {
  static commandName = "mycommand";
  static options: CommandOptions = {
    loggerPath: "src/custom-logger.ts",
  };
}
```

### Programmatic Override

You can also call `CommandRegistry.setLogger()` directly with a pino instance:

```typescript
import pino from "pino";
import { CommandRegistry } from "balda";

CommandRegistry.setLogger(pino({ level: "debug" }));
```

This overrides the logger for `CommandRegistry` and all `Command` subclasses.

## Log Levels

| Level    | Numeric Value | Use Case                                                |
| -------- | ------------- | ------------------------------------------------------- |
| `trace`  | 10            | Very detailed debugging (not recommended in production) |
| `debug`  | 20            | Debugging information                                   |
| `info`   | 30            | General informational messages                          |
| `warn`   | 30            | Warning messages                                        |
| `error`  | 40            | Error messages                                          |
| `fatal`  | 60            | Critical errors that require immediate attention        |
| `silent` | Infinity      | Disable logging                                         |

## API Reference

### `Server({ logger })`

Pass a Pino logger instance to the server constructor.

```typescript
import pino from "pino";
import { Server } from "balda";

const server = new Server({
  logger: pino({ level: "debug" }),
});
```

If omitted, the default internal logger is used.

### `CommandRegistry.setLogger(logger)`

Override the default logger for all CLI commands programmatically.

```typescript
import pino from "pino";
import { CommandRegistry } from "balda";

CommandRegistry.setLogger(pino({ level: "debug" }));
```

### `CommandRegistry.loggerPath`

Path to a file exporting a pino `logger` instance, resolved automatically by the CLI before command execution. Defaults to `"src/logger.ts"`.

```typescript
import { CommandRegistry } from "balda";

CommandRegistry.loggerPath = "src/custom-logger.ts";
```

### `logger`

The default logger instance exported by Balda.

```typescript
import { logger } from "balda";

logger.info(message, ...args);
logger.error(message, ...args);
logger.warn(message, ...args);
logger.debug(message, ...args);
```

## Learn More

- [Pino Documentation](https://getpino.io/) - Full Pino API reference
- [pino-pretty](https://github.com/pinojs/pino-pretty) - Pretty printing options
- [Server Configuration](../getting-started/configuration) - Server-level configuration
