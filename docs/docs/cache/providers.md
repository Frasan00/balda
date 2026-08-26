---
title: Cache Providers
description: Configure cache backends with in-memory, Redis, or custom providers. Choose the right storage for your use case.
keywords: [balda, cache, providers, redis, memory, storage]
sidebar_position: 2
---

# Cache Providers

Balda supports three types of cache backends: the built-in in-memory provider, a Redis-backed provider, and any custom provider you implement.

## Memory Provider (default)

The `MemoryCacheProvider` stores entries in a `Map` inside the current process. It requires no dependencies and is the default when `provider` is omitted.

```ts
import { Server } from "balda";

const server = new Server({
  cache: {
    provider: "memory",
    defaultTtl: 120,
  },
});
```

:::info
The memory provider is scoped to a single process. Entries are lost on restart and are **not shared** across multiple instances. Use Redis for production deployments.
:::

## Redis Provider

The `RedisCacheProvider` uses [ioredis](https://github.com/redis/ioredis) as a peer dependency. Install it first:

```bash
npm install ioredis
```

Then configure the server:

```ts
import { Server } from "balda";

const server = new Server({
  cache: {
    provider: "redis",
    redis: {
      host: "localhost",
      port: 6379,
      password: "secret",
    },
  },
});
```

### Redis Connection Options

| Option      | Type     | Default       | Description                                      |
| ----------- | -------- | ------------- | ------------------------------------------------ |
| `host`      | `string` | `'localhost'` | Redis server hostname                            |
| `port`      | `number` | `6379`        | Redis server port                                |
| `password`  | `string` | —             | Redis AUTH password                              |
| `db`        | `number` | `0`           | Redis database index                             |
| `keyPrefix` | `string` | —             | Prefix for all Redis keys                        |
| `url`       | `string` | —             | Full Redis URL (overrides host/port/password/db) |

### Using a Connection URL

```ts
const server = new Server({
  cache: {
    provider: "redis",
    redis: {
      url: "redis://:password@redis-host:6379/0",
    },
  },
});
```

### Using a Pre-configured Instance

You can also pass a `RedisCacheProvider` instance directly, for example to share a connection or configure advanced ioredis options:

```ts
import { Server } from "balda";
import { RedisCacheProvider } from "balda";

const redisProvider = new RedisCacheProvider({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  keyPrefix: "myapp:",
});

const server = new Server({
  cache: { provider: redisProvider },
});
```

## Custom Provider

Implement the `CacheProvider` interface to use any storage backend (Memcached, DynamoDB, Upstash, etc.).

```ts
import type { CacheProvider } from "balda";

class MyCustomProvider implements CacheProvider {
  async get(key: string): Promise<string | null> {
    /* ... */
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    /* ... */
  }
  async del(key: string): Promise<boolean> {
    /* ... */
  }
  async delMany(keys: string[]): Promise<number> {
    /* ... */
  }
  async addToSet(
    key: string,
    members: string[],
    ttlSeconds?: number,
  ): Promise<void> {
    /* ... */
  }
  async getSetMembers(key: string): Promise<string[]> {
    /* ... */
  }
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    /* ... */
  }
  async releaseLock(key: string): Promise<void> {
    /* ... */
  }
  async *scan(pattern: string): AsyncIterable<string[]> {
    /* ... */
  }
  async disconnect(): Promise<void> {
    /* ... */
  }
}

const server = new Server({
  cache: { provider: new MyCustomProvider() },
});
```

### `CacheProvider` Interface

| Method          | Signature                                  | Description                                  |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| `get`           | `(key) → Promise<string \| null>`          | Fetch a raw string by key                    |
| `set`           | `(key, value, ttlSeconds) → Promise<void>` | Store with TTL                               |
| `del`           | `(key) → Promise<boolean>`                 | Delete one key; returns `true` if it existed |
| `delMany`       | `(keys) → Promise<number>`                 | Bulk delete; returns count deleted           |
| `addToSet`      | `(key, members, ttl?) → Promise<void>`     | Add to a set (used for tag tracking)         |
| `getSetMembers` | `(key) → Promise<string[]>`                | Read all set members                         |
| `acquireLock`   | `(key, ttlMs) → Promise<boolean>`          | NX-style lock; `true` if acquired            |
| `releaseLock`   | `(key) → Promise<void>`                    | Release a lock                               |
| `scan`          | `(pattern) → AsyncIterable<string[]>`      | Cursor-scan by glob pattern                  |
| `disconnect`    | `() → Promise<void>`                       | Clean up connections                         |
