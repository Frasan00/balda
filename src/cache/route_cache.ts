import { logger } from "../logger/logger.js";
import type {
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../runtime/native_server/server_types.js";
import { executeMiddlewareChain } from "../runtime/native_server/server_utils.js";
import type { Request } from "../server/http/request.js";
import type { Response } from "../server/http/response.js";
import type { CacheRouteOptions } from "../server/server_types.js";
import type { CacheAdapter } from "./cache_adapter.js";

/**
 * Cached response payload structure
 */
type CachedPayload = {
  status: number;
  headers: Record<string, string>;
  body: any;
};

/**
 * Options for building cache keys
 */
export type BuildCacheKeyOptions = {
  includeQuery?: boolean;
  includeHeaders?: boolean;
  headers?: Record<string, string>;
};

/**
 * Sort object keys for deterministic stringification
 */
const sortKeys = (obj: Record<string, any>): Record<string, any> => {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, any> = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  return sorted;
};

/**
 * Convert Headers to a plain Record for deterministic cache key building
 */
const headersFromRequest = (headers: Headers): Record<string, string> => {
  return Object.fromEntries(headers.entries());
};

/**
 * Build a deterministic cache key from method, path pattern, params, and optionally query/headers
 * @param method - HTTP method (e.g. "GET")
 * @param pathPattern - Path pattern with :param segments (e.g. /users/profiles/:profileId)
 * @param params - Route params extracted from path
 * @param query - Query parameters
 * @param options - Optional cache key building options (includeQuery, includeHeaders, headers)
 * @returns Cache key string
 */
export const buildCacheKey = (
  method: string,
  pathPattern: string,
  params: Record<string, string>,
  query: Record<string, string>,
  options?: BuildCacheKeyOptions,
): string => {
  const sortedParams = sortKeys(params);
  let key = `cache:${method}:${pathPattern}:${JSON.stringify(sortedParams)}`;

  // Include query only if explicitly requested
  if (options?.includeQuery) {
    const sortedQuery = sortKeys(query);
    key += `:${JSON.stringify(sortedQuery)}`;
  }

  // Include headers only if explicitly requested and headers are provided
  if (options?.includeHeaders && options?.headers) {
    const sortedHeaders = sortKeys(options.headers);
    key += `:${JSON.stringify(sortedHeaders)}`;
  }

  return key;
};

/**
 * Execute handler with cache wrapper. Checks cache before execution; stores result after miss.
 * @param adapter - Cache adapter for get/set operations
 * @param cacheOptions - Cache options (ttl, key override)
 * @param pathPattern - Path pattern for cache key building
 * @param middleware - Middleware chain to execute
 * @param handler - Route handler to execute
 * @param req - Request object
 * @param res - Response object
 * @returns Response object after execution
 */
export const executeWithCache = async (
  adapter: CacheAdapter,
  cacheOptions: CacheRouteOptions,
  pathPattern: string,
  middleware: ServerRouteMiddleware[],
  handler: ServerRouteHandler,
  req: Request,
  res: Response,
): Promise<Response> => {
  // Build cache key
  const key =
    cacheOptions.key ??
    buildCacheKey(req.method, pathPattern, req.params, req.query, {
      includeQuery: cacheOptions.includeQuery ?? false,
      includeHeaders: cacheOptions.includeHeaders ?? false,
      headers: cacheOptions.includeHeaders
        ? headersFromRequest(req.headers)
        : undefined,
    });

  // Try to get from cache
  try {
    const cached = await adapter.get<CachedPayload>(key);
    if (cached) {
      // Cache hit - replay response
      res.status(cached.status);
      for (const [headerKey, headerValue] of Object.entries(cached.headers)) {
        res.setHeader(headerKey, headerValue);
      }
      res.send(cached.body);
      return res;
    }
  } catch (error) {
    // Cache get failure - treat as miss and continue
    logger.debug({ error, key }, "Cache get failed, treating as miss");
  }

  // Cache miss - execute middleware chain
  await executeMiddlewareChain(middleware, handler, req, res);

  // Capture response for caching
  try {
    const body = res.getBody();
    const payload: CachedPayload = {
      status: res.responseStatus,
      headers: { ...res.headers },
      body,
    };

    // Store in cache
    await adapter.set(key, payload, cacheOptions.ttl);
  } catch (error) {
    // Cache set failure - log and continue (response already sent)
    logger.debug({ error, key }, "Cache set failed");
  }

  return res;
};
