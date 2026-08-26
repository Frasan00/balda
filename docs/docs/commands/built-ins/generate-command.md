---
title: generate-command
description: Generate a new custom CLI command for Balda with proper structure and decorators.
keywords: [balda, generate command, cli, scaffold, generator]
sidebar_position: 6
---

# generate-command

Generate a new custom CLI command.

```bash
npx balda generate-command hello -p src/commands
```

## Flags

- `-p, --path <string>`: Target directory (default `src/commands`)

## Generated Code

```ts
import { Command, CommandOptions } from "balda";

export default class extends Command {
  static commandName = "hello";
  static description = "Command description";

  static options: CommandOptions = {
    keepAlive: false,
  };

  static async handle(): Promise<void> {
    // Implement your command logic here
  }
}
```

:::warning
Command names must be unique and cannot conflict with built-in commands.
:::
