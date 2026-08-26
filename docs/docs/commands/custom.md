---
title: Custom CLI Commands
description: Create custom CLI commands for Balda using decorators for flags and arguments. Organize commands with categories and validation.
keywords:
  [balda, cli, custom commands, decorators, flags, arguments, command line]
sidebar_position: 3
---

### Custom CLI Commands

Author your own CLI commands using Balda's command framework.

#### 1) Create a command class

```ts title="src/commands/hello.ts"
import { Command } from "balda";

export default class HelloCommand extends Command {
  static commandName = "hello";
  static description = "Say hello";
  static help = ["Example: npx balda hello --name Alice"];

  static async handle(): Promise<void> {
    const name = this.commandName || "world";
    console.log(`Hello, ${name}!`);
  }
}
```

#### 2) Add flags/args with decorators

```ts
import { flag, Command } from "balda";

export default class HelloCommand extends Command {
  @flag.string({ name: "name", aliases: "n", description: "Your name" })
  static name: string;
  // ...
}
```

#### 3) Make the CLI discover your commands

```ts title="src/commands/command_registry.ts"
import { commandRegistry } from "balda";

// All the commands must be in the src/commands directory
commandRegistry.setCommandsPattern("./src/commands/**/*.ts");
```

Run `npx balda list` to verify your command is loaded.

#### Important: Using Decorators with Static Properties

When using `@flag` and `@arg` decorators on static properties, **do not use the `declare` keyword** as it prevents the property from being emitted at runtime. Instead, use the definite assignment assertion (`!`):

```ts
export default class MyCommand extends Command {
  @flag.string({ name: "name" })
  static name!: string; // ✅ Correct - property exists at runtime
}
```

**❌ Incorrect:**

```ts
export default class MyCommand extends Command {
  @flag.string({ name: "name" })
  declare static name: string; // ❌ Wrong - property won't exist at runtime
}
```

The `declare` keyword tells TypeScript to not emit the property in the compiled JavaScript, which breaks the decorator's ability to set the value.

#### Flag Types

Balda supports multiple flag types with full type safety:

##### String Flags

```ts
import { Command, flag } from "balda";

export default class MyCommand extends Command {
  static commandName = "mycommand";
  static description = "Example command";

  @flag.string({
    name: "name",
    aliases: ["n"],
    description: "User name",
    defaultValue: "guest",
  })
  static name: string;

  static async handle(): Promise<void> {
    console.log(`Hello, ${this.name}!`);
  }
}
```

Usage: `npx balda mycommand --name=Alice` or `npx balda mycommand -n Alice`

##### Boolean Flags

```ts
@flag.boolean({
  name: 'verbose',
  aliases: ['v'],
  description: 'Enable verbose output',
  defaultValue: false,
})
static verbose: boolean;
```

Usage: `npx balda mycommand --verbose` or `npx balda mycommand -v`

##### Number Flags

```ts
@flag.number({
  name: 'port',
  aliases: ['p'],
  description: 'Port number',
  defaultValue: 3000,
})
static port: number;
```

Usage: `npx balda mycommand --port=8080` or `npx balda mycommand -p 8080`

##### List Flags (Multiple Values)

List flags can be specified multiple times to collect an array of values:

```ts
@flag.list({
  name: 'tag',
  aliases: ['t'],
  description: 'Add tags (can be specified multiple times)',
  defaultValue: [],
})
static tags: string[];
```

Usage: `npx balda mycommand --tag=frontend --tag=api --tag=v2`

Or with aliases: `npx balda mycommand -t frontend -t api -t v2`

**Complete Example:**

```ts
import { Command, flag } from "balda";

export default class DeployCommand extends Command {
  static commandName = "deploy";
  static description = "Deploy application with tags";

  @flag.list({
    name: "tag",
    aliases: ["t"],
    description: "Deployment tags",
    defaultValue: [],
  })
  static tags: string[];

  @flag.list({
    name: "env",
    aliases: ["e"],
    description: "Environment variables (KEY=VALUE)",
    parse: (value: string) => {
      const [key, val] = value.split("=");
      return `${key}=${val}`;
    },
  })
  static envVars?: string[];

  @flag.string({
    name: "region",
    description: "Deployment region",
    required: true,
  })
  static region!: string;

  static async handle(): Promise<void> {
    console.log(`Deploying to ${this.region}`);
    console.log(`Tags: ${this.tags.join(", ")}`);
    if (this.envVars) {
      console.log(`Environment: ${this.envVars.join(", ")}`);
    }
  }
}
```

Usage:

```bash
npx balda deploy \
  --region=us-east-1 \
  --tag=v1.0.0 \
  --tag=production \
  --tag=hotfix \
  -e NODE_ENV=production \
  -e DEBUG=false
```

#### Flag Options

All flag types support the following options:

| Option              | Type                 | Description                                                                                                                               |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `string`             | Flag name (defaults to property name)                                                                                                     |
| `aliases`           | `string \| string[]` | Short aliases for the flag                                                                                                                |
| `description`       | `string`             | Help text description                                                                                                                     |
| `required`          | `boolean`            | Whether the flag is required                                                                                                              |
| `defaultValue`      | varies by type       | Default value if not provided                                                                                                             |
| `parse`             | `(value: any) => T`  | Custom parser function                                                                                                                    |
| `allowUnknownFlags` | `boolean`            | Whether to allow unknown flags. Defaults to `true`. If set to `false`, the command will exit with an error if unknown flags are provided. |

**Note:** For list flags, the `parse` function is called on each individual item, not the entire array.

#### Command Options

Commands can be configured with additional options using the `options` static property:

```ts
import { Command, CommandOptions } from "balda";

export default class MyCommand extends Command {
  static commandName = "mycommand";
  static description = "Example command";

  static options: CommandOptions = {
    // Whether the command should keep the process alive after completion or not
    keepAlive: true,
    category: "utility",
  };

  static async handle(): Promise<void> {
    // Command implementation
  }
}
```

##### Available Options

| Option       | Type       | Description                                                                                                                                                               |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keepAlive`  | `boolean`  | Keep process alive after command completes (default: `false`)                                                                                                             |
| `category`   | `string`   | Group commands in help output (`'generator'`, `'utility'`, etc.)                                                                                                          |
| `deprecated` | `object`   | Mark command as deprecated with optional migration info                                                                                                                   |
| `validate`   | `function` | Custom validation function that runs before `handle()`                                                                                                                    |
| `loggerPath` | `string`   | Path to a file exporting a pino `logger` instance, loaded before command execution. Overrides `CommandRegistry.loggerPath` for this command. (default: `"src/logger.ts"`) |

#### Custom Command Logger

CLI commands run standalone via `npx balda <command>` — there is no user-controlled entrypoint. The CLI automatically resolves the logger before executing a command:

1. It imports the file at `CommandRegistry.loggerPath` (default: `"src/logger.ts"`) or the per-command `CommandOptions.loggerPath` override
2. It looks for a **named `logger` export** (a pino instance)
3. If found, it calls `CommandRegistry.setLogger()` — all commands use that logger

Since `balda init` scaffolds `src/logger.ts` exporting a pino instance (the same file imported by `server.ts`), both the server and CLI commands share the same logger by default.

##### Changing the global logger path

```ts
import { CommandRegistry } from "balda";

CommandRegistry.loggerPath = "src/custom-logger.ts";
```

##### Per-command override

```ts
import { Command, CommandOptions } from "balda";

export default class MyCommand extends Command {
  static commandName = "mycommand";
  static options: CommandOptions = {
    loggerPath: "src/verbose-logger.ts",
  };

  static async handle(): Promise<void> {
    this.logger.info("Using a custom logger for this command only");
  }
}
```

##### Programmatic override

To use a custom logger without a file, call `CommandRegistry.setLogger()` directly:

```ts
import pino from "pino";
import { CommandRegistry } from "balda";

CommandRegistry.setLogger(pino({ level: "debug" }));
```

This overrides the static logger on `CommandRegistry` and on the `Command` base class (inherited by all subclasses).

##### Command Categories

Organize your commands in the `list` output by assigning them to categories:

```ts
export default class GenerateApiCommand extends Command {
  static commandName = "generate-api";
  static description = "Generate API boilerplate";

  static options: CommandOptions = {
    category: "generator",
  };

  static async handle(): Promise<void> {
    // Generate API code
  }
}
```

Common categories: `'generator'`, `'setup'`, `'production'`, `'utility'`, `'database'`

When you run `npx balda list`, commands will be grouped by category:

```
User Commands:

  GENERATOR:
    generate-api         Generate API boilerplate
    generate-model       Generate database model

  UTILITY:
    clear-cache          Clear application cache
```

##### Deprecated Commands

Mark commands as deprecated to guide users toward newer alternatives:

```ts
export default class OldCommand extends Command {
  static commandName = "old-deploy";
  static description = "Legacy deployment command";

  static options: CommandOptions = {
    deprecated: {
      message: "This command is deprecated",
      replacement: "deploy",
    },
  };

  static async handle(): Promise<void> {
    // Still functional but discouraged
  }
}
```

When users run a deprecated command, they'll see a warning:

```bash
⚠️  Warning: This command is deprecated
   Use 'deploy' instead.
```

Deprecated commands also appear with a **[deprecated]** tag in the `list` output.

##### Custom Validation

Add custom validation logic that runs before the command executes:

```ts
export default class DeployCommand extends Command {
  static commandName = "deploy";
  static description = "Deploy to production";

  @flag.string({ name: "env", required: true })
  static environment!: string;

  static options: CommandOptions = {
    validate: (command) => {
      const validEnvs = ["staging", "production"];
      if (!validEnvs.includes(command.environment)) {
        console.error(
          `Invalid environment. Must be one of: ${validEnvs.join(", ")}`,
        );
        return false;
      }
      return true;
    },
  };

  static async handle(): Promise<void> {
    console.log(`Deploying to ${this.environment}...`);
  }
}
```

The `validate` function:

- Receives the command class as a parameter
- Must return `boolean` or `Promise<boolean>`
- Runs after flags are parsed but before `handle()`
- If it returns `false`, the command will not execute

##### Complete Example

```ts
import { Command, CommandOptions, flag } from "balda";

export default class BackupCommand extends Command {
  static commandName = "backup";
  static description = "Create database backup";

  static options: CommandOptions = {
    category: "database",
    validate: async (command) => {
      // Check if database is accessible
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        console.error("Cannot connect to database");
        return false;
      }
      return true;
    },
  };

  @flag.string({
    name: "output",
    aliases: ["o"],
    description: "Output directory",
    defaultValue: "./backups",
  })
  static outputDir!: string;

  @flag.boolean({
    name: "compress",
    description: "Compress backup file",
    defaultValue: true,
  })
  static compress!: boolean;

  static async handle(): Promise<void> {
    console.log(`Creating backup in ${this.outputDir}`);
    console.log(`Compression: ${this.compress ? "enabled" : "disabled"}`);
    // Backup logic here
  }
}
```
