import { logger } from "../logger/logger.js";
import type { ServerRouteMiddleware } from "../runtime/native_server/server_types.js";
import { CACHE_STATUS_HEADER, CacheStatus } from "./cache.constants.js";
import type { CacheService } from "./cache.service.js";
import type {
  CachePluginOptionsResolved,
  CacheRouteConfigResolved,
  LockBehavior,
} from "./cache.types.js";
import { generateCacheKey } from "./cache.utils.js";

/**
 * Creates a cache middleware for a specific route configuration.
 *
 * The middleware checks the cache before handler execution and stores
 * the response in the cache after successful handler execution.
 */
export function createCacheMiddleware(
  cacheService: CacheService,
  routeConfig: CacheRouteConfigResolved,
  pluginOptions: CachePluginOptionsResolved,
): ServerRouteMiddleware {
  const log = logger.child({ scope: "CacheMiddleware" });

  return async (req, res, next) => {
    try {
      // Extract headers as plain object for cache key
      const headersObj: Record<string, string> = {};
      if (routeConfig.includeHeaders && req.headers) {
        if (routeConfig.headerKeys) {
          for (const key of routeConfig.headerKeys) {
            const val = req.headers.get(key);
            if (val) headersObj[key] = val;
          }
        } else {
          req.headers.forEach((val, key) => {
            headersObj[key] = val;
          });
        }
      }

      // Generate cache key — extract pathname only (req.url may be a full URL)
      const rawUrl = req.url;
      const routePath = rawUrl.startsWith("http")
        ? new URL(rawUrl).pathname
        : rawUrl.split("?")[0];

      const fromRequestValue = routeConfig.fromRequest
        ? await routeConfig.fromRequest(req)
        : undefined;

      const key = generateCacheKey({
        prefix: pluginOptions.keyPrefix,
        method: req.method,
        route: routePath,
        routeParams: req.params,
        body: req.body,
        bodyKeys: routeConfig.bodyKeys,
        includeBody: routeConfig.includeBody,
        query: req.query as Record<string, string>,
        queryKeys: routeConfig.queryKeys,
        includeQuery: routeConfig.includeQuery,
        headers: headersObj,
        headerKeys: routeConfig.headerKeys,
        includeHeaders: routeConfig.includeHeaders,
        fromRequestValue,
      });

      log.debug({ key }, "Generated cache key");

      // Check cache
      const cached = await cacheService.get(key);

      if (cached !== null) {
        res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Hit);
        res.json(cached);
        return;
      }

      // Cache miss — try to acquire lock (thundering herd protection)
      const lockAcquired = await cacheService.acquireLock(key);

      if (!lockAcquired) {
        const behavior = routeConfig.lockBehavior ?? pluginOptions.lockBehavior;
        const result = await handleLockContention(
          behavior,
          cacheService,
          key,
          pluginOptions.lockTimeout,
          res,
        );

        if (!result.continueToHandler) {
          return;
        }
      }

      res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Miss);

      // Call the next middleware / handler
      await next();

      // After handler: cache the response if successful
      try {
        if (res.responseStatus >= 200 && res.responseStatus < 300) {
          const body = res.getBody();
          const data = typeof body === "string" ? JSON.parse(body) : body;

          await cacheService.set(key, data, routeConfig.ttl, {
            compressed: routeConfig.useCompression,
            tags: routeConfig.tags,
          });

          log.debug({ key, ttl: routeConfig.ttl }, "Cached response");
        }
      } catch (cacheError) {
        log.error({ error: cacheError, key }, "Failed to cache response");
      } finally {
        if (lockAcquired) {
          await cacheService.releaseLock(key);
        }
      }
    } catch (error) {
      log.error({ error }, "Cache middleware error");
      res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Bypass);
      return next();
    }
  };
}

interface LockContentionResult {
  continueToHandler: boolean;
}

async function handleLockContention(
  behavior: LockBehavior,
  cacheService: CacheService,
  key: string,
  lockTimeout: number,
  res: any,
): Promise<LockContentionResult> {
  switch (behavior) {
    case "bypass":
      res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Bypass);
      return { continueToHandler: true };

    case "fail":
      res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Bypass);
      res.setHeader("Retry-After", String(Math.ceil(lockTimeout / 1000)));
      res.status(503).json({
        error: "Service Unavailable",
        message: "Cache computation in progress",
      });
      return { continueToHandler: false };

    case "wait":
    default: {
      res.setHeader(CACHE_STATUS_HEADER, CacheStatus.Wait);
      const waitResult = await cacheService.waitForCache(key, lockTimeout);
      if (waitResult !== null) {
        res.json(waitResult);
        return { continueToHandler: false };
      }
      // Timeout: fall through to handler
      return { continueToHandler: true };
    }
  }
}
