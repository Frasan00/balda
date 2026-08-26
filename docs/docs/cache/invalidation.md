---
title: Cache Invalidation
description: Invalidate cached responses with tag-based, key-based, and pattern-based strategies. Use CacheService singleton.
keywords: [balda, cache, invalidation, purge, clear, tags]
sidebar_position: 4
---

# Invalidation

Balda provides three invalidation strategies: **tag-based**, **key-based**, and **pattern-based**. All are available via `getCacheService()`, which returns the global `CacheService` singleton.

:::warning
`getCacheService()` returns `null` if `initCacheService()` has not been called. Always initialize the cache service before accessing it.
:::

## Accessing the Cache Service

```ts
import {
  initCacheService,
  MemoryCacheProvider,
  DEFAULT_CACHE_OPTIONS,
  getCacheService,
} from "balda";

// Initialize before server bootstrap
initCacheService(new MemoryCacheProvider(), {
  ...DEFAULT_CACHE_OPTIONS,
});

// Access the cache service anywhere
const cacheService = getCacheService(); // CacheService | null
await cacheService?.invalidate(["products"]);
```

## Tag-Based Invalidation

Tags let you group related cache entries and invalidate them together. Assign tags in the cache config:

```ts
// Decorator
@get('/products')
@cache({ ttl: 120, tags: ['products'] })
async listProducts(_req, res) { /* ... */ }

@get('/products/:id')
@cache({ ttl: 120, tags: ['products'] })
async getProduct(req, res) { /* ... */ }
```

Then invalidate all entries tagged `'products'` in one call:

```ts
// e.g. after a product is updated
await getCacheService()?.invalidate(["products"]);
```

Multiple tags can be invalidated at once:

```ts
await getCacheService()?.invalidate(["products", "categories"]);
```

:::info
Internally, each tag maps to a Redis set (or in-memory set) that stores all cache keys sharing that tag. Invalidation deletes those keys and the tag set itself.
:::

## Key-Based Invalidation

Delete a single known cache key:

```ts
await getCacheService()?.invalidateKey("cache:GET:/api/products::abc123");
```

This returns `true` if the key existed and was deleted, `false` otherwise.

## Pattern-Based Invalidation

Delete all keys matching a glob pattern. Useful when you know the route prefix but not the exact key hashes:

```ts
// Invalidate all cached GET /api/products/** entries
await getCacheService()?.invalidatePattern("cache:GET:/api/products*");

// Wipe everything under the default prefix
await getCacheService()?.invalidatePattern("cache:*");
```

Returns the total number of keys deleted.

## Manual `get` / `set`

The cache service also exposes low-level `get` and `set` methods for custom caching logic outside of route middleware:

```ts
// Read from cache
const cached = await getCacheService()?.get<User[]>("my-custom-key");

if (!cached) {
  const data = await db.users.findAll();

  // Store with a 60-second TTL, tagged for later invalidation
  await getCacheService()?.set("my-custom-key", data, 60, { tags: ["users"] });
}
```

## Invalidation in Route Handlers

A common pattern is to invalidate cache entries when data changes:

```ts
import { controller, post, put, del } from "balda";
import { getCacheService } from "balda";

@controller("/api/products")
class ProductController {
  @post("/")
  async create(req, res) {
    const product = await db.products.create(req.body);
    await getCacheService()?.invalidate(["products"]);
    res.status(201).json(product);
  }

  @put("/:id")
  async update(req, res) {
    const product = await db.products.update(req.params.id, req.body);
    await getCacheService()?.invalidate(["products"]);
    res.json(product);
  }

  @del("/:id")
  async remove(req, res) {
    await db.products.delete(req.params.id);
    await getCacheService()?.invalidate(["products"]);
    res.status(204).send();
  }
}
```
