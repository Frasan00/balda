import type { RequestSchema } from "../decorators/validation/validate_types.js";
import type {
  ExtractParams,
  InferBodyType,
  InferQueryType,
  InferSchemaType,
} from "../server/router/path_types.js";
import type { Request } from "../server/http/request.js";
import type { SyncOrAsync } from "../type_util.js";

/**
 * Behavior when cache lock cannot be acquired (thundering herd protection).
 * - `wait`: Poll for cache until timeout, then execute handler (default)
 * - `bypass`: Execute handler immediately without waiting
 * - `fail`: Return 503 Service Unavailable immediately
 */
export type LockBehavior = "wait" | "bypass" | "fail";

/**
 * Specifies which request data to include in the cache key.
 * - `true`: include all fields
 * - `string[]`: include only the specified field names
 *
 * Params from the URL path are always included automatically.
 */
export interface CacheKeyIncludes {
  /** Include request body fields in cache key */
  body?: boolean | string[];
  /** Include query string fields in cache key */
  query?: boolean | string[];
  /** Include request headers in cache key */
  headers?: boolean | string[];
  /**
   * Custom discriminator function. The return value is hashed and appended to
   * the cache key, allowing arbitrary request data (e.g. auth context, tenant)
   * to be used as a cache dimension.
   *
   * @example
   * include: { fromRequest: (req) => req.headers.get("x-tenant-id") }
   */
  fromRequest?: (req: Request) => SyncOrAsync<unknown>;
}

/**
 * Type-safe cache key includes when schemas are available (router inline config).
 * Allows picking specific fields from body/query schemas.
 * `fromRequest` receives a fully-typed Request so body and query fields are inferred.
 */
export type TypedCacheKeyIncludes<
  TBody extends RequestSchema | unknown = unknown,
  TQuery extends RequestSchema | unknown = unknown,
  TPath extends string = string,
> = {
  body?: TBody extends RequestSchema
    ? boolean | (keyof InferSchemaType<TBody>)[]
    : boolean | string[];
  query?: TQuery extends RequestSchema
    ? boolean | (keyof InferSchemaType<TQuery>)[]
    : boolean | string[];
  headers?: boolean | string[];
  /**
   * Custom discriminator function. Receives the fully-typed request and must
   * return a value that is hashed into the cache key.
   *
   * @example
   * include: { fromRequest: (req) => req.body.tenantId }
   */
  fromRequest?: (
    req: Request<
      ExtractParams<TPath>,
      InferBodyType<TBody>,
      InferQueryType<TQuery> extends Record<string, any>
        ? InferQueryType<TQuery>
        : Record<string, unknown>
    >,
  ) => SyncOrAsync<unknown>;
};

/**
 * Cache configuration for a route.
 *
 * @example
 * ```typescript
 * // Decorator usage
 * @cache({ ttl: 60, tags: ['chat-messages'] })
 *
 * // Inline router usage
 * router.get('/users', {
 *   cache: { ttl: 120, include: { query: ['page', 'limit'] } }
 * }, handler)
 * ```
 */
export interface CacheRouteConfig {
  /** Time-to-live in seconds (max 86400 = 24 hours) */
  ttl: number;
  /** Enable gzip compression for responses larger than compressionThreshold */
  useCompression?: boolean;
  /** Tags for bulk invalidation via server.cache.invalidate(tags) */
  tags?: string[];
  /** Behavior when lock cannot be acquired (default: 'wait') */
  lockBehavior?: LockBehavior;
  /**
   * Specifies which request data to include in the cache key.
   * Params are always included automatically.
   * When omitted, body is included by default for backward compatibility.
   */
  include?: CacheKeyIncludes;
}

/**
 * Type-safe cache route config for inline router usage with schema inference.
 */
export type TypedCacheRouteConfig<
  TBody extends RequestSchema | unknown = unknown,
  TQuery extends RequestSchema | unknown = unknown,
  TPath extends string = string,
> = Omit<CacheRouteConfig, "include"> & {
  include?: TypedCacheKeyIncludes<TBody, TQuery, TPath>;
};

/**
 * Resolved cache configuration at runtime with all includes normalized to string arrays.
 */
export interface CacheRouteConfigResolved extends Omit<
  CacheRouteConfig,
  "include"
> {
  /** Specific body keys to include in cache key (undefined = include all body) */
  bodyKeys?: string[];
  /** Specific query keys to include in cache key (undefined = do not include query) */
  queryKeys?: string[];
  /** Specific header names to include in cache key (undefined = do not include headers) */
  headerKeys?: string[];
  /** Whether to include all body fields (true if include.body was true or omitted) */
  includeBody: boolean;
  /** Whether to include all query fields */
  includeQuery: boolean;
  /** Whether to include all headers */
  includeHeaders: boolean;
  /** Optional fromRequest function extracted from include.fromRequest */
  fromRequest?: (req: Request) => SyncOrAsync<unknown>;
}

/**
 * Internal cache entry metadata stored by providers.
 */
export interface CacheEntry {
  /** Serialized response data (may be base64 if compressed) */
  data: string;
  /** Whether the data is gzip compressed */
  compressed: boolean;
  /** Unix timestamp when cache entry was created */
  createdAt: number;
  /** TTL in seconds */
  ttl: number;
}

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate (0.0 - 1.0) */
  hitRate: number;
  /** Total keys invalidated */
  invalidations: number;
}

/**
 * Cache service interface exposed on the server instance.
 *
 * Access via `server.cache` after cache is configured in server options.
 *
 * @example
 * ```typescript
 * // Get cached value
 * const data = await server.cache.get<UserData>('cache:user:123:/api/users:abc')
 *
 * // Invalidate by tags
 * await server.cache.invalidate(['user:123', 'chat-messages'])
 *
 * // Get stats
 * const stats = server.cache.getStats()
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`)
 * ```
 */
export interface CacheServiceInterface {
  /** Get a cached value by key */
  get<T = unknown>(key: string): Promise<T | null>;
  /** Set a cached value */
  set(
    key: string,
    value: unknown,
    ttl: number,
    opts?: { compressed?: boolean; tags?: string[] },
  ): Promise<void>;
  /** Invalidate all cache entries with any of the given tags */
  invalidate(tags: string[]): Promise<number>;
  /** Invalidate a specific cache key */
  invalidateKey(key: string): Promise<boolean>;
  /** Invalidate all keys matching a pattern (e.g., 'cache:user:123:*') */
  invalidatePattern(pattern: string): Promise<number>;
  /** Get cache statistics */
  getStats(): CacheStats;
}

/**
 * Options for configuring the cache system in ServerOptions.
 */
export interface CachePluginOptions {
  /**
   * The cache provider to use.
   * - `'memory'`: built-in in-memory cache (default)
   * - `'redis'`: Redis-backed cache (requires ioredis peer dependency)
   * - `CacheProvider`: custom provider instance
   */
  provider?: "memory" | "redis" | CacheProvider;
  /** Redis connection options (only used when provider is 'redis') */
  redis?: CacheRedisOptions;
  /** Default TTL in seconds (default: 300) */
  defaultTtl?: number;
  /** Minimum response size in bytes to apply compression (default: 1024) */
  compressionThreshold?: number;
  /** Key prefix for all cache entries (default: 'cache') */
  keyPrefix?: string;
  /** Enable statistics tracking (default: true) */
  enableStats?: boolean;
  /** Lock timeout in milliseconds for thundering herd protection (default: 5000) */
  lockTimeout?: number;
  /** Default behavior when lock cannot be acquired (default: 'wait') */
  lockBehavior?: LockBehavior;
}

/**
 * Redis connection options for the Redis cache provider.
 */
export interface CacheRedisOptions {
  /** Redis host (default: 'localhost') */
  host?: string;
  /** Redis port (default: 6379) */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number (default: 0) */
  db?: number;
  /** Redis key prefix */
  keyPrefix?: string;
  /** Full Redis connection URL (overrides host/port/password/db) */
  url?: string;
}

/**
 * Internal resolved plugin options with defaults applied.
 */
export interface CachePluginOptionsResolved {
  defaultTtl: number;
  compressionThreshold: number;
  keyPrefix: string;
  enableStats: boolean;
  lockTimeout: number;
  lockBehavior: LockBehavior;
}

/**
 * Abstract cache provider interface.
 * Implement this to create a custom cache backend.
 *
 * @example
 * ```typescript
 * class MyCustomProvider implements CacheProvider {
 *   async get(key: string) { ... }
 *   async set(key: string, value: string, ttlSeconds: number) { ... }
 *   // ...
 * }
 *
 * const server = new Server({
 *   cache: { provider: new MyCustomProvider() }
 * })
 * ```
 */
export interface CacheProvider {
  /** Get a raw string value by key */
  get(key: string): Promise<string | null>;
  /** Set a raw string value with TTL in seconds */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Delete a single key, returns true if key existed */
  del(key: string): Promise<boolean>;
  /** Delete multiple keys, returns count of deleted keys */
  delMany(keys: string[]): Promise<number>;
  /** Add members to a set key with optional TTL */
  addToSet(key: string, members: string[], ttlSeconds?: number): Promise<void>;
  /** Get all members of a set */
  getSetMembers(key: string): Promise<string[]>;
  /** Acquire a lock (NX semantics), returns true if acquired */
  acquireLock(key: string, ttlMs: number): Promise<boolean>;
  /** Release a previously acquired lock */
  releaseLock(key: string): Promise<void>;
  /** Scan keys matching a glob pattern, yields batches */
  scan(pattern: string): AsyncIterable<string[]>;
  /** Disconnect and clean up resources */
  disconnect(): Promise<void>;
}

/**
 * Internal state tracked per request for cache operations.
 */
export interface PendingCacheOp {
  /** Generated cache key */
  key: string;
  /** Whether this request acquired the lock */
  locked: boolean;
  /** Cache configuration for this route */
  config: CacheRouteConfigResolved;
}
