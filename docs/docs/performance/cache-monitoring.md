---
title: Cache Monitoring
description: Track schema compilation and serialization performance. Monitor memory usage and optimize long-running applications.
keywords: [balda, performance, cache, monitoring, memory, optimization]
sidebar_position: 1
---

# Cache Monitoring

Balda provides a comprehensive cache monitoring system to track schema compilation and serialization performance. This is essential for understanding memory usage and optimizing long-running applications.

## Overview

The framework uses three parallel caches for optimal performance:

1. **Validator Cache** (`openapiSchemaMap`) - Compiled AJV validators
2. **Serializer Cache** (`fastJsonStringifyMap`) - fast-json-stringify functions
3. **JSON Schema Cache** (`jsonSchemaCache`) - Converted JSON schemas for Swagger/OpenAPI

All caches use WeakMap-based keys for automatic garbage collection when schemas are no longer referenced.

## Cache Types

### 1. Validator Cache

**Purpose**: Stores compiled AJV validators for request/response validation

**Key Type**: Symbol (from WeakMap) or string (for primitives)

**Lifecycle**: Application lifetime

**Used by**:

- `@validate` decorator
- `Request.validate()`
- `@serialize` decorator (when `throwErrorOnValidationFail: true`)

**Memory**: ~1-5KB per validator

### 2. Serializer Cache

**Purpose**: Stores fast-json-stringify functions for high-performance JSON serialization

**Key Type**: Symbol (shared with validators)

**Lifecycle**: Application lifetime

**Used by**:

- `@serialize` decorator
- `Response.json()` with schemas

**Memory**: ~2-10KB per serializer

### 3. JSON Schema Cache

**Purpose**: Stores converted JSON schemas for Swagger/OpenAPI documentation

**Key Type**: Symbol (shared with validators and serializers)

**Lifecycle**: Application lifetime

**Used by**:

- Swagger plugin
- OpenAPI spec generation

**Memory**: ~0.5-2KB per schema

## API Reference

### `getCacheMetrics()`

Returns comprehensive metrics about all schema caches.

**Returns**: `CacheMetrics`

```typescript
interface CacheMetrics {
  validators: {
    size: number;
    description: string;
  };
  serializers: {
    size: number;
    schemaRefsCreated: number;
    entries: Array<{
      key: string;
      compiledAt: number;
      schemaType: string;
    }>;
  };
  jsonSchemas: {
    size: number;
    description: string;
  };
  totalSchemaReferences: number;
  memoryEstimate: {
    validators: string;
    serializers: string;
    jsonSchemas: string;
    total: string;
  };
}
```

**Example**:

```typescript
import { getCacheMetrics } from "balda";

const metrics = getCacheMetrics();

console.log(`Validators cached: ${metrics.validators.size}`);
console.log(`Serializers cached: ${metrics.serializers.size}`);
console.log(`JSON schemas cached: ${metrics.jsonSchemas.size}`);
console.log(`Total memory estimate: ${metrics.memoryEstimate.total}`);
console.log(`Schema references created: ${metrics.totalSchemaReferences}`);

// Inspect individual serializer entries
metrics.serializers.entries.forEach((entry) => {
  console.log(
    `${entry.key}: ${entry.schemaType} (compiled ${Date.now() - entry.compiledAt}ms ago)`,
  );
});
```

### `logCacheMetrics()`

Logs cache metrics using the structured logger (Pino).

**Returns**: `void`

**Example**:

```typescript
import { logCacheMetrics } from "balda";

// Log at server startup
server.listen(3000, () => {
  logCacheMetrics();
});

// Log periodically for monitoring
setInterval(() => {
  logCacheMetrics();
}, 60000); // Every minute
```

**Output format**:

```json
{
  "level": 30,
  "time": 1706543210000,
  "msg": "Schema cache metrics",
  "validators": 42,
  "serializers": 38,
  "jsonSchemas": 40,
  "totalSchemaRefs": 45,
  "memoryEstimate": "~1.2MB"
}
```

### `clearAllCaches()`

Clears all schema caches. This forces all schemas to be recompiled on next use.

**Returns**: `void`

**Warning**: This will impact performance as schemas need to be recompiled. Only use in specific scenarios:

- Testing environments
- Memory pressure situations
- Hot reload during development

**Example**:

```typescript
import { clearAllCaches } from "balda";

// Clear during hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearAllCaches();
  });
}

// Clear in tests
afterEach(() => {
  clearAllCaches();
});
```

## Cache Invalidation Strategy

### Current Strategy

**No automatic invalidation** - Caches persist for the application lifetime.

**Why?**

- Schema objects rarely change at runtime
- Pre-compilation at startup provides optimal performance
- WeakMap keys ensure garbage collection when schemas are unreferenced

### When Caches Are Populated

Caches are automatically populated during:

1. **Route registration** - Eager compilation via `router.addOrUpdate()`
2. **Decorator application** - When `@serialize` or `@validate` decorators are applied
3. **First request** - Lazy compilation for dynamic routes
4. **Swagger generation** - When OpenAPI spec is generated

### Cache Warming

**Best practice**: Pre-compile all schemas at startup for optimal performance.

Schemas defined in route decorators and inline routes are **automatically pre-compiled** during route registration, ensuring the first request is fast.

```typescript
import { Server, controller, get, serialize } from "balda";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

@controller("/users")
class UserController {
  // Schema is pre-compiled during controller registration
  @get("/:id")
  @serialize(UserSchema)
  getUser() {
    return { id: 1, name: "John", email: "john@example.com" };
  }
}

// All schemas compiled during bootstrap
const server = new Server({ controllers: [UserController] });
await server.bootstrap();
await server.listen(3000);
```

## Memory Considerations

### Automatic Garbage Collection

- Schema objects use **WeakMap-based keys**
- When a schema object is no longer referenced, its cache entry is automatically garbage collected
- No manual cleanup needed for unreferenced schemas

### Long-Running Processes

For applications with dynamic schema generation:

1. **Monitor cache size** regularly using `getCacheMetrics()`
2. **Set up alerts** when memory exceeds thresholds
3. **Consider manual clearing** if memory pressure is detected

```typescript
import { getCacheMetrics, clearAllCaches, logger } from "balda";

// Monitor cache size every 5 minutes
setInterval(() => {
  const metrics = getCacheMetrics();
  const totalCacheSize =
    metrics.validators.size +
    metrics.serializers.size +
    metrics.jsonSchemas.size;

  if (totalCacheSize > 10000) {
    logger.warn({ totalCacheSize }, "Cache size exceeds threshold");

    // Consider clearing if memory pressure is critical
    // clearAllCaches();
  }
}, 300000);
```

### Memory Estimates

Cache metrics include **rough memory estimates** based on average sizes:

- Each validator: ~1-5KB
- Each serializer: ~2-10KB
- Each JSON schema: ~0.5-2KB

Actual sizes vary based on schema complexity.

## Use Cases

### Health Check Endpoints

Expose cache metrics in health check endpoints:

```typescript
import { Server, controller, get, getCacheMetrics } from "balda";

@controller("/health")
class HealthController {
  @get("/cache")
  getCacheHealth() {
    const metrics = getCacheMetrics();

    return {
      status: "healthy",
      cache: {
        validators: metrics.validators.size,
        serializers: metrics.serializers.size,
        jsonSchemas: metrics.jsonSchemas.size,
        memory: metrics.memoryEstimate.total,
      },
      timestamp: Date.now(),
    };
  }
}
```

### Performance Monitoring Dashboards

Integrate with monitoring tools like Prometheus, Grafana, or Datadog:

```typescript
import { getCacheMetrics } from "balda";
import { register, Gauge } from "prom-client";

// Create Prometheus metrics
const cacheValidatorsGauge = new Gauge({
  name: "balda_cache_validators_total",
  help: "Total number of cached validators",
});

const cacheSerializersGauge = new Gauge({
  name: "balda_cache_serializers_total",
  help: "Total number of cached serializers",
});

const cacheMemoryGauge = new Gauge({
  name: "balda_cache_memory_kb",
  help: "Estimated cache memory usage in KB",
});

// Update metrics periodically
setInterval(() => {
  const metrics = getCacheMetrics();

  cacheValidatorsGauge.set(metrics.validators.size);
  cacheSerializersGauge.set(metrics.serializers.size);

  // Parse memory estimate (e.g., "~1.2MB" -> 1200)
  const memoryMatch = metrics.memoryEstimate.total.match(/~([\d.]+)(KB|MB)/);
  if (memoryMatch) {
    const value = parseFloat(memoryMatch[1]);
    const unit = memoryMatch[2];
    const kb = unit === "MB" ? value * 1024 : value;
    cacheMemoryGauge.set(kb);
  }
}, 15000);
```

### Development Debugging

Log cache metrics during development to understand schema compilation:

```typescript
import { Server, logCacheMetrics } from "balda";

const server = new Server({
  controllers: ["./controllers/**/*.ts"],
});

await server.bootstrap();

// Log cache metrics after all routes are registered
if (process.env.NODE_ENV === "development") {
  logCacheMetrics();
}

await server.listen(3000);
```

### Testing Environments

Clear caches between tests to ensure isolation:

```typescript
import { describe, it, beforeEach, afterEach } from "vitest";
import { clearAllCaches, getCacheMetrics } from "balda";

describe("Cache tests", () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it("should start with empty caches", () => {
    const metrics = getCacheMetrics();
    expect(metrics.validators.size).toBe(0);
    expect(metrics.serializers.size).toBe(0);
  });
});
```

## Performance Impact

### Cache Hit vs Miss

**Cache Hit** (schema already compiled):

- Validator lookup: ~0.01ms
- Serializer lookup: ~0.01ms
- JSON Schema lookup: ~0.01ms

**Cache Miss** (first compilation):

- Validator compilation: ~5-50ms (depending on schema complexity)
- Serializer compilation: ~10-100ms (depending on schema complexity)
- JSON Schema conversion: ~1-10ms (Zod to JSON Schema)

**Recommendation**: Pre-compile all schemas at startup to avoid cache misses during requests.

### Memory vs Speed Trade-off

Caching provides significant performance benefits with minimal memory overhead:

- **Speed gain**: 100-1000x faster (0.01ms vs 10-100ms)
- **Memory cost**: ~3-15KB per schema (all three caches combined)

For most applications, this is an excellent trade-off.

## Best Practices

1. **Monitor in production** - Set up periodic cache metrics logging
2. **Alert on anomalies** - Create alerts for unusual cache growth
3. **Pre-compile schemas** - Use route decorators for automatic pre-compilation
4. **Test cache behavior** - Verify schemas are cached as expected
5. **Profile memory usage** - Monitor `memoryEstimate` in long-running processes
6. **Clear intentionally** - Only clear caches when necessary (testing, hot reload)
7. **Use structured logging** - Always use `logCacheMetrics()` over manual console.log

## Related APIs

- [`@serialize` decorator](../core-concepts/request-response.md) - Automatic response serialization
- [`@validate` decorator](../core-concepts/request-response.md) - Request validation
- [Swagger Plugin](../plugins/swagger.md) - OpenAPI documentation generation
- [Server Configuration](../core-concepts/server.md) - Server setup and options
