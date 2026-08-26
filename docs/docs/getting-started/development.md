---
title: Development Guide
description: Set up hot reload development workflow with Balda CLI on Node.js, Bun, or Deno. Development server configuration and best practices.
keywords:
  [balda, development, hot reload, tsx, bun watch, deno watch, debugging]
sidebar_position: 4
---

# Development Guide

This guide covers development workflows for building Balda applications with hot reload support across different JavaScript runtimes.

## Hot Reload Development

Hot reload allows your server to automatically restart when you make changes to your code, significantly speeding up the development process.

### Using Balda CLI (Recommended)

The easiest way to run your Balda server in development mode is using the built-in `serve` command:

```bash
npx balda serve
```

This command automatically:

- Detects your runtime (Node.js, Bun, or Deno)
- Uses the appropriate hot reload mechanism for your runtime
- Installs required dependencies if needed (like `tsx` for Node.js)
- Watches for file changes and restarts your server automatically

**Custom entry point:**

```bash
npx balda serve ./src/server.ts
```

**With flags:**

```bash
npx balda serve --deno-import-map ./import_map.json
```

The serve command uses:

- **Node.js**: `tsx` with watch mode (automatically installed if missing)
- **Bun**: `bun run --watch`
- **Deno**: `deno run --watch` with required permissions

:::tip
The `npx balda serve` command is the recommended way to run your development server as it handles all runtime-specific configuration automatically.
:::

### Manual Setup (Alternative)

If you prefer to set up hot reload manually or need more control over the configuration, you can use the runtime-specific tools directly:

### Node.js

For Node.js projects, you can use several tools for hot reloading:

#### Using tsx (Recommended)

[tsx](https://github.com/privatenumber/tsx) is a fast TypeScript execution environment with watch mode.

**Installation:**

```bash
npm install -D tsx
```

**Usage:**

```bash
tsx watch src/index.ts
```

**Package.json script:**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

Then run:

```bash
npm run dev
```

#### Using ts-node-dev

[ts-node-dev](https://github.com/wclr/ts-node-dev) is another popular option with fast recompilation.

**Installation:**

```bash
npm install -D ts-node-dev
```

**Usage:**

```bash
ts-node-dev --respawn --transpile-only src/index.ts
```

**Package.json script:**

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  }
}
```

### Bun

Bun has built-in watch mode support with excellent performance.

**Usage:**

```bash
bun run --watch src/index.ts
```

**Package.json script:**

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts"
  }
}
```

Then run:

```bash
bun run dev
```

### Deno

Deno provides built-in watch mode with the `--watch` flag.

**Usage:**

```bash
deno run --allow-net --allow-read --watch src/index.ts
```

**deno.json script:**

```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-read --watch src/index.ts"
  }
}
```

Then run:

```bash
deno task dev
```
