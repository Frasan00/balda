---
id: cli
title: Command-Line Interface
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# `@cli/` overview

Balda ships with an opinionated, TypeScript-first CLI—think of it as a meta-toolbox. It scaffolds new commands, plugins, and cron jobs so you can stay focused on application logic.

```bash title="General syntax"
npx balda <command> [options] [arguments]
```

Need help?

```bash title="Global & command help"
npx balda # access the cli
npx balda <command> -h  # command-specific help
```

---

## Built-in generators

### 1. `generate-command`

Scaffolds a new CLI command file.

| Argument / Flag | Type   | Default          | Description                              |
| --------------- | ------ | ---------------- | ---------------------------------------- |
| `<name>`        | string | — (required)     | File (and class) name of the new command |
| `-p`, `--path`  | string | `src/commands`   | Target directory                         |

```bash title="Example"
npx balda generate-command hello-world -p tools/cli
```

---

### 2. `generate-plugin`

Creates a plugin skeleton.

| Argument / Flag | Type   | Default       | Description                          |
| --------------- | ------ | ------------- | ------------------------------------ |
| `<pluginName>`  | string | — (required)  | Plugin filename & class name         |
| `-p`, `--path`  | string | `src/plugins` | Directory where the file is written |

```bash title="Example"
npx balda generate-plugin auth -p src/plugins/security
```

---

### 3. `generate-cron`

Bootstraps a cron-job class adorned with the `@cron()` decorator.

| Argument / Flag | Type   | Default   | Description               |
| --------------- | ------ | --------- | ------------------------- |
| `<fileName>`    | string | —         | Cron job filename         |
| `-p`, `--path`  | string | `src/cron`| Where to create the file  |

```bash title="Example"
npx balda generate-cron clean-sessions -p src/maintenance/cron
```

---

## Extending the CLI

Declare your own commands and tell Balda where to find them:

```ts title="Custom command discovery"
import { CommandRegistry } from '@cli/';

CommandRegistry.setCommandsPattern('./my/commands/**/*.ts');
```

At startup the CLI loads:

1. Anything matching the pattern above.
2. The built-in generators described earlier.

> **Tip:** Use decorators (`@arg`, `@flag`) in your command classes for self-documenting, runtime-validated definitions.

---

## Help & validation

Each command inherits colourised `--help` output **and** validation for missing/invalid flags. Introduce an error:

```bash
npx balda generate-plugin
```

You’ll get a detailed, friendly validation report and a non-zero exit code.

---

## Next steps

• Install globally with `npm i -g balda` if you prefer the shorter `balda` binary.
• Peek at `src/commands/base_command.ts` for advanced goodies like `keepAlive`.
• Curious about decorators? Check **Docs → Decorators** (coming soon).
