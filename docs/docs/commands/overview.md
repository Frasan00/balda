---
title: CLI Commands Overview
description: Balda's CLI provides built-in generators and utilities for project initialization, development, and production. Create custom commands with decorators.
keywords: [balda, cli, commands, npx, terminal, generators, scaffolding]
sidebar_position: 1
---

### Commands Overview

Balda's CLI provides built-in generators and utilities to speed up your workflow. You can also author custom commands.
Commands are stateless so every time you run a command it will start from scratch and you need to handle dependency injection yourself.
Custom commands MUST be placed in the `src/commands` directory (you can't change this in the config file).

#### Built-in commands

**Initialization & Setup:**

- `init`: scaffold a new project structure
- `init-queue`: initialize queue provider configuration
- `init-mailer`: initialize mailer configuration with template engines
- `init-storage`: initialize storage provider with dependencies

**Development:**

- `serve`: start development server with hot reload
- `list`: display all available commands

**Production:**

- `queue-start`: start queue workers to process jobs
- `cron-start`: start cron job scheduler

**Security:**

- `key-generate`: generate RSA public/private key pairs

**Generators:**

- `generate-command`: scaffold a CLI command
- `generate-controller`: scaffold an HTTP controller
- `generate-middleware`: scaffold a middleware
- `generate-plugin`: scaffold a plugin
- `generate-queue`: scaffold a queue handler
- `generate-cron`: scaffold a cron job
- `generate-sdk`: generate TypeScript SDK from OpenAPI spec

**Build:**

- `build`: build the project for production (Node.js only, requires `esbuild`)

### Command Usage

#### Node

```bash
# Using npx
npx balda <command> [options]

# Using yarn
yarn balda <command> [options]

# Using pnpm
pnpm balda <command> [options]
```

#### Bun

```bash
bun run balda <command> [options]
```

#### Deno

- Deno is a little bit more complex and requires some setup. First, you need to create the following deno_cli.ts file in your project (name does not matter):

```typescript
const command = new Deno.Command("node", {
  args: ["node_modules/.bin/balda", ...Deno.args],
  stdout: "piped",
  stderr: "piped",
});

const { code, stdout, stderr } = await command.output();

console.log("Exit code:", code);

const stderrText = new TextDecoder().decode(stderr);
if (stderrText) {
  console.error("stderr:", stderrText);
}

const stdoutText = new TextDecoder().decode(stdout);
if (stdoutText) {
  console.log("stdout:", stdoutText);
} else {
  console.log("No output from command");
}

export {};
```

- Then you can run any command like this:

```bash
deno run -A deno_cli.ts <command> [options]
```
