---
title: build
description: Build Balda project for production with esbuild. Supports ESM/CJS formats, sourcemaps, and asset copying.
keywords: [balda, build, production, esbuild, bundle, compile]
sidebar_position: 13
---

# build

Build the project for production (Node.js only).

```bash
npx balda build -t ./tsconfig.json -a ./assets
```

## Flags

- `-c, --clear-dist <boolean>`: Clear dist directory before building (default `false`)
- `-e, --entry <string>`: Entry point (default `./src/index.ts`)
- `-o, --output <string>`: Output directory (default `./dist`)
- `-t, --tsconfig <string>`: Path to tsconfig.json (default `./tsconfig.json`)
- `-a, --assets <string>`: Assets directory to copy to output
- `-f, --format <string>`: Build format: `esm` or `cjs` (default `esm`)
- `-p, --packages <string>`: Package bundling: `bundle` or `external` (default `external`)
- `-s, --sourcemap <boolean>`: Generate sourcemaps (default `true`)

## Requirements

- Must have `esbuild` installed: `npm install -D esbuild`
- For assets: `npm install -D esbuild-plugin-copy`

## Example

```bash
npx balda build \
  --entry ./src/server.ts \
  --output ./dist \
  --assets ./public \
  --format esm \
  --clear-dist
```

## Build Output

- Main file: `./dist/server.js`
- Assets (if specified): `./dist/assets/*`
- Source maps (if enabled): `./dist/server.js.map`
