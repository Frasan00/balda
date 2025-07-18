import {
  InMemoryStorage,
  InMemoryStorageInterface,
} from "src/plugins/rate_limiter/in_memory_storage";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "./rate_limiter_types";

/**
 * Rate limiter plugin
 * Rate limiter is a plugin that limits the number of requests to a resource.
 * It can be used to protect a resource from abuse.
 * @param keyOptions Rate limiter key options, tells the middleware how to retrieve the key from the request in to discriminate what to rate limit (all optional, defaults to ip)
 * @param storageOptions Rate limiter storage options, tells the middleware how to store the rate limit data (all optional, defaults to memory)
 */
export const rateLimiter = (
  keyOptions?: RateLimiterKeyOptions,
  storageOptions?: StorageOptions,
): ServerRouteMiddleware => {
  const baseKeyOptions: RateLimiterKeyOptions = {
    type: "ip",
    limit: 100,
    message: "ERR_RATE_LIMIT_EXCEEDED",
    statusCode: 429,
    ...keyOptions,
  };

  const baseStorageOptions: StorageOptions = {
    type: "memory",
    ...storageOptions,
  };

  if (baseStorageOptions.type === "memory" && !baseStorageOptions.windowMs) {
    baseStorageOptions.windowMs = 60000;
  }

  const storage: InMemoryStorageInterface =
    baseStorageOptions.type === "memory"
      ? new InMemoryStorage(baseStorageOptions.windowMs!)
      : {
          get: baseStorageOptions.get,
          set: baseStorageOptions.set,
        };

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = baseKeyOptions.type === "ip" ? req.ip : baseKeyOptions.key(req);
    const value = await storage.get(key!);
    if (value >= baseKeyOptions.limit!) {
      return res.status(baseKeyOptions.statusCode!).json({
        message: baseKeyOptions.message,
      });
    }

    await storage.set(key!, value + 1);
    return next();
  };
};
