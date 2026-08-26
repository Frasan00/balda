---
title: generate-sdk
description: Generate a TypeScript SDK client from your OpenAPI specification for type-safe API calls.
keywords: [balda, generate sdk, openapi, typescript, client, codegen]
sidebar_position: 12
---

# generate-sdk

Generate a TypeScript SDK from your server's OpenAPI specification.

```bash
npx balda generate-sdk
npx balda generate-sdk src/server/index.ts -o ./client-sdk
npx balda generate-sdk --client axios --unwrap-response-data
```

## Arguments

- `serverPath`: Path to server instance file (default: `test/server/instance.ts`)

## Flags

- `-o, --output <path>`: Output directory (default: `sdk`)
- `-s, --swagger-path <path>`: Swagger UI path (default: `/docs`)
- `-c, --client <type>`: HTTP client: `axios` or `fetch` (default: `fetch`)
- `--unwrap-response-data`: Unwrap response data property
- `--single-http-client`: Generate single HTTP client instance
- `--type-prefix <prefix>`: Add prefix to all types
- `--type-suffix <suffix>`: Add suffix to all types
- `--enum-names-as-values`: Use enum names as values
- `--sort-types`: Sort types alphabetically

## Requirements

- Server must have Swagger plugin enabled
- Server file must export a `Server` instance

## What it does

1. Imports your server instance
2. Starts the server if needed
3. Downloads OpenAPI specification
4. Generates TypeScript SDK with type safety
5. Stops server and cleans up

## Generated Structure

```
sdk/
├── Api.ts              # Main API client
├── data-contracts.ts   # TypeScript interfaces
├── http-client.ts      # HTTP client
└── routes/             # Route handlers
    ├── Users.ts
    └── ...
```

## Usage Example

```ts
import { Api } from "./sdk/Api";

const api = new Api({ baseUrl: "http://localhost:3000" });

const users = await api.users.getUsers();
const user = await api.users.getUserById(1);
```

See [Swagger documentation](/docs/plugins/swagger) for more information.
