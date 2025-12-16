import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type {
  AsyncLocalStorageContext,
  AsyncLocalStorageContextSetters,
} from "./async_local_storage_types.js";
import { AsyncLocalStorage } from "node:async_hooks";

export const asyncStorage = new AsyncLocalStorage<Record<string, any>>();

/**
 * Async local storage plugin middleware, used to store data in the request context
 */
export const asyncLocalStorage = (
  ctxSetters: AsyncLocalStorageContextSetters
): ServerRouteMiddleware => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const store: Record<string, any> = {};

    for (const [key, setter] of Object.entries(ctxSetters)) {
      store[key] = (setter as (req: Request) => {})(req);
    }

    asyncStorage.run(store, () => {
      req.ctx = new Proxy({} as AsyncLocalStorageContext, {
        get(_, prop) {
          const currentStore = asyncStorage.getStore();
          return currentStore?.[prop as string];
        },
        set(_, prop, value) {
          const currentStore = asyncStorage.getStore();
          if (currentStore) {
            currentStore[prop as string] = value;
            return true;
          }

          return false;
        },
        ownKeys() {
          const currentStore = asyncStorage.getStore();
          return currentStore ? Object.keys(currentStore) : [];
        },
        has(_, prop) {
          const currentStore = asyncStorage.getStore();
          return currentStore ? prop in currentStore : false;
        },
      });

      next();
    });
  };
};
