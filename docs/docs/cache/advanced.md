---
title: Advanced Caching
description: Decorator vs inline router config, custom key generators, and advanced cache configurations.
keywords: [balda, cache, advanced, decorator, custom keys]
sidebar_position: 5
---

# Advanced

## `@cache()` Decorator vs Inline Router Config

Both approaches are equivalent at runtime. Choose based on your routing style:

|                           | `@cache()` decorator  | Inline router config      |
| ------------------------- | --------------------- | ------------------------- |
| Used with                 | Controller classes    | `server.router.*()`       |
| Type-safe `include` picks | ❌ (no schema access) | ✅ (inferred from schema) |
| Tag support               | ✅                    | ✅                        |
| `fromRequest`             | ✅                    | ✅                        |

**Decorator:**

```ts
import { controller, get, cache } from "balda";

@controller("/api/users")
class UserController {
  @get("/:id")
  @cache({ ttl: 60, tags: ["users"] })
  async getUser(req, res) {
    /* ... */
  }
}
```

**Inline:**

```ts
server.router.get(
  "/api/users/:id",
  { cache: { ttl: 60, tags: ["users"] } },
  (req, res) => {
    /* ... */
  },
);
```

## Response Compression

For large responses, Balda can gzip-compress the serialized JSON before storing it in the cache.

Enable it per-route:

```ts
@cache({ ttl: 300, useCompression: true })
```

Compression is only applied when the serialized response exceeds `compressionThreshold` (default: 1024 bytes). Smaller responses are stored as-is regardless of the `useCompression` flag.

Configure the threshold when initializing the cache service:

```ts
import {
  initCacheService,
  RedisCacheProvider,
  DEFAULT_CACHE_OPTIONS,
} from "balda";

initCacheService(new RedisCacheProvider({ host: "localhost" }), {
  ...DEFAULT_CACHE_OPTIONS,
  compressionThreshold: 2048, // compress responses > 2 KB
});
```

## Thundering Herd Protection

When many concurrent requests hit a cold cache entry at the same time, only the first request should execute the handler — the rest should wait for the result. Balda handles this with a distributed lock.

### How it works

1. The first request acquires a lock for the cache key.
2. Subsequent requests detect the lock and enter a wait loop (polling every 50 ms).
3. Once the first request stores the result and releases the lock, waiting requests serve the cached response.
4. If the lock expires before the cache is populated, waiting requests fall through to execute the handler themselves.

### `lockBehavior`

Control what happens when a lock cannot be acquired via `lockBehavior` (global default) or per-route:

| Value      | Behaviour                                                            |
| ---------- | -------------------------------------------------------------------- |
| `'wait'`   | Poll until the cache is populated or `lockTimeout` expires (default) |
| `'bypass'` | Execute the handler immediately without waiting                      |
| `'fail'`   | Return `503 Service Unavailable` immediately                         |

```ts
// Global default
import { initCacheService, RedisCacheProvider, DEFAULT_CACHE_OPTIONS } from 'balda';

initCacheService(new RedisCacheProvider({ host: 'localhost' }), {
  ...DEFAULT_CACHE_OPTIONS,
  lockTimeout: 5000,      // ms before lock expires
  lockBehavior: 'bypass', // fall through instead of waiting
});

// Per-route override
@cache({ ttl: 60, lockBehavior: 'fail' })
```

## Statistics

When `enableStats: true` (the default), Balda tracks cache activity and exposes it via `getCacheService()?.getStats()`:

```ts
import { getCacheService } from "balda";

const stats = getCacheService()?.getStats();
// {
//   hits: 142,
//   misses: 38,
//   hitRate: 0.789,
//   invalidations: 5,
// }

console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

| Field           | Type     | Description                                    |
| --------------- | -------- | ---------------------------------------------- |
| `hits`          | `number` | Total cache hits since server start            |
| `misses`        | `number` | Total cache misses since server start          |
| `hitRate`       | `number` | `hits / (hits + misses)` (0.0 – 1.0)           |
| `invalidations` | `number` | Total keys deleted via any invalidation method |

Disable stats tracking to save a small amount of overhead:

```ts
import {
  initCacheService,
  MemoryCacheProvider,
  DEFAULT_CACHE_OPTIONS,
} from "balda";

initCacheService(new MemoryCacheProvider(), {
  ...DEFAULT_CACHE_OPTIONS,
  enableStats: false,
});
```
