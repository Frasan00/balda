---
title: serve
description: Run the Balda development server with hot reload. Auto-detects Node.js, Bun, or Deno runtime.
keywords: [balda, serve, development, hot reload, tsx, watch mode]
sidebar_position: 5
---

# serve

Run the server in development mode with hot reload.

```bash
npx balda serve ./src/index.ts
```

## Arguments

- `entry`: Entry point (default `./src/index.ts`)

## Flags

- `-d, --deno-import-map <string>`: Deno import map path (Deno only)

## Runtime Detection

The command automatically detects your runtime and uses the appropriate hot reload:

- **Bun**: `bun run --watch`
- **Deno**: `deno run --watch` with `--unstable-sloppy-imports` and `--allow-all`
- **Node.js**: `tsx` (automatically installs if missing)

## Example

```bash
npx balda serve ./src/server.ts
```
