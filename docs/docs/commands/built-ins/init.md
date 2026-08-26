---
title: init
description: Scaffold a new Balda project with TypeScript, optional MQTT service, and cron job configuration.
keywords: [balda, init, scaffold, new project, setup, typescript]
sidebar_position: 1
---

# init

Scaffold a minimal Balda project with optional service integrations.

```bash
npx balda init -p ./src -t true
npx balda init --mqtt --cron
```

## Flags

- `-p, --path <string>`: Target directory (default `./src`)
- `-t, --typescript <boolean>`: Generate TS files (default `true`)
- `-m, --mqtt <boolean>`: Initialize MQTT service (default `false`)
- `-c, --cron <boolean>`: Initialize Cron service (default `false`)

## What it does

1. Installs required dev dependencies (`esbuild`, `esbuild-plugin-copy`, `tsx`, `typescript`)
2. Creates `server.ts` with basic server configuration
3. Creates `index.ts` with server startup
4. If `--mqtt`: Creates `src/mqtt/mqtt.config.ts` and connection setup
5. If `--cron`: Creates `src/cron/cron.config.ts` and service initialization

## Generated Structure

```
src/
├── server.ts
├── index.ts
├── logger.ts
├── mqtt/           # if --mqtt flag
│   └── mqtt.config.ts
└── cron/           # if --cron flag
    └── cron.config.ts
```
