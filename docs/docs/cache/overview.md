---
title: Caching Overview
description: HTTP caching layer for Balda with provider-agnostic storage. Intercept routes and serve cached responses.
keywords: [balda, cache, caching, http, performance, optimization]
sidebar_position: 1
---

# Caching Overview

Balda provides a first-class, provider-agnostic HTTP caching layer. When enabled, it transparently intercepts route handlers, stores responses in your chosen backend, and serves subsequent identical requests directly from cache — without executing the handler again. The `@cache()` route decorator and route‑level `cache:` config are part of the routing contract; the cache runtime is registered by calling `initCacheService()` (install `ioredis` only if you use the Redis provider).

## Features

- **Zero-config in-memory cache** — works out of the box, no dependencies
- **Redis backend** — persistent, shared cache across multiple instances (`ioredis`)
- **Custom providers** — bring any storage backend via the `CacheProvider` interface
- **Fine-grained key control** — include body, query, headers, or a custom discriminator in the cache key
- **Tag-based invalidation** — group entries by tag and invalidate them in one call
- **Thundering herd protection** — distributed locks prevent cache stampedes
- **Response compression** — gzip large responses before storing
- **Statistics** — track hit rate, miss count, and invalidations via `getCacheService()?.getStats()`

## Quick Start

There are two ways to enable caching. Use whichever fits your setup:

**Option 1 — via `plugins.cache` in `ServerOptions`:**

```ts
import { Server } from "balda";

const server = new Server({
  port: 3000,
  plugins: {
    cache: {
      provider: "memory", // or 'redis', or a custom CacheProvider instance
      defaultTtl: 300,
    },
  },
});
```

**Option 2 — via `server.use()` with `cacheMiddleware()`:**

```ts
import { Server } from "balda";
import { cacheMiddleware, MemoryCacheProvider } from "balda";

const server = new Server({ port: 3000 });
server.use(cacheMiddleware(new MemoryCacheProvider(), { defaultTtl: 300 }));
```

Both approaches initialize the global `CacheService` so that `@cache()` decorators and `getCacheService()` work everywhere. Once initialized, use the `@cache()` decorator or inline router config on any route:

```ts
import { controller, get, cache } from "balda";

@controller("/api/products")
class ProductController {
  @get("/")
  @cache({ ttl: 60 })
  async list(_req, res) {
    res.json(await db.products.findAll());
  }
}
```

## Configuration

The cache service is standalone. Configure it via `plugins.cache` in `ServerOptions`, `server.use(cacheMiddleware(...))`, or call `initCacheService()` directly.

| Option                 | Type                           | Default   | Description                                       |
| ---------------------- | ------------------------------ | --------- | ------------------------------------------------- |
| `defaultTtl`           | `number`                       | `300`     | Default TTL in seconds (max 86400)                |
| `compressionThreshold` | `number`                       | `1024`    | Min response size (bytes) before gzip compression |
| `keyPrefix`            | `string`                       | `'cache'` | Prefix applied to all cache keys                  |
| `enableStats`          | `boolean`                      | `true`    | Track hit/miss statistics                         |
| `lockTimeout`          | `number`                       | `5000`    | Lock TTL in ms for thundering herd protection     |
| `lockBehavior`         | `'wait' \| 'bypass' \| 'fail'` | `'wait'`  | What to do when a lock can't be acquired          |

### Using `plugins.cache` in ServerOptions

```ts
import { Server } from "balda";

const server = new Server({
  port: 3000,
  plugins: {
    // Memory provider (default)
    cache: { provider: "memory", defaultTtl: 300 },

    // Redis provider
    // cache: { provider: 'redis', redis: { host: 'localhost' }, defaultTtl: 600 },

    // Custom provider instance
    // cache: { provider: new MyCustomProvider(), defaultTtl: 300 },
  },
});
```

### Using `cacheMiddleware()` with `server.use()`

Useful when you need more control over middleware ordering or want to compose the cache setup outside of server options:

```ts
import { Server } from "balda";
import { cacheMiddleware, MemoryCacheProvider } from "balda";

const server = new Server({ port: 3000 });
server.use(cacheMiddleware(new MemoryCacheProvider(), { defaultTtl: 300 }));
```

### Using `initCacheService()` Directly

For advanced use cases (e.g. CLI commands, workers) where you need the cache service without a server:

```ts
import {
  initCacheService,
  MemoryCacheProvider,
  DEFAULT_CACHE_OPTIONS,
} from "balda";

initCacheService(new MemoryCacheProvider(), {
  ...DEFAULT_CACHE_OPTIONS,
  defaultTtl: 300,
});
```

## The `x-cache` Response Header

Every response from a cached route includes an `x-cache` header indicating the cache status:

| Value    | Meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| `MISS`   | Cache miss — handler executed, response stored                     |
| `HIT`    | Cache hit — response served from cache                             |
| `WAIT`   | Request waited for another in-flight request to populate the cache |
| `BYPASS` | Lock could not be acquired and `lockBehavior` was `'bypass'`       |

## Accessing the Cache Service

After calling `initCacheService()`, use `getCacheService()` to access the full `CacheService` API:

```ts
import { getCacheService } from "balda";

// Invalidate by tags
await getCacheService()?.invalidate(["products"]);

// Invalidate a specific key
await getCacheService()?.invalidateKey("cache:GET:/api/products::abc123");

// Get statistics
const stats = getCacheService()?.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

:::warning
`getCacheService()` returns `null` if `initCacheService()` has not been called. Always initialize the cache service before accessing it.
:::
