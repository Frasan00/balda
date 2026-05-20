import {
  InMemoryStorage,
  InMemoryStorageInterface,
} from "./in_memory_storage.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type {
  RateLimiterKeyOptions,
  StorageOptions,
} from "./rate_limiter_types.js";

/**
 * Rate limiter plugin.
 * Uses a fixed-window, atomic-increment counter keyed on IP or a custom value.
 *
 * @param keyOptions  How to derive the rate-limit key from the request.
 * @param storageOptions  Where to store counters (in-memory or custom atomic store).
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

  const windowMs =
    baseStorageOptions.type === "memory"
      ? (baseStorageOptions.windowMs ?? 60_000)
      : 60_000;

  const failClosed = baseKeyOptions.failClosed ?? false;

  const storage: InMemoryStorageInterface =
    baseStorageOptions.type === "memory"
      ? new InMemoryStorage(windowMs, (baseStorageOptions as any).maxKeys)
      : {
          increment: (baseStorageOptions as any).increment,
        };

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = baseKeyOptions.type === "ip" ? req.ip : baseKeyOptions.key(req);

    if (!key) {
      // No key available (e.g. ip is undefined without trust proxy) — pass through
      return next();
    }

    let count: number;
    try {
      const result = await storage.increment(key, windowMs);
      count = result.count;
    } catch {
      if (failClosed) {
        return res.status(baseKeyOptions.statusCode!).json({
          message: baseKeyOptions.message,
        });
      }

      return next();
    }

    if (count > baseKeyOptions.limit!) {
      return res.status(baseKeyOptions.statusCode!).json({
        message: baseKeyOptions.message,
      });
    }

    return next();
  };
};
