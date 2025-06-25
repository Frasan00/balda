import { MetadataStore } from "../../metadata_store";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";

/**
 * Decorator to mark a middleware for a route or a controller class
 */
export const middleware = (
  middleware: ServerRouteMiddleware | ServerRouteMiddleware[],
) => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    // Class decorator usage
    if (typeof propertyKey === "undefined") {
      let meta = MetadataStore.get(target.prototype, "__class__");
      if (!meta) {
        meta = { middlewares: [] };
      }

      if (!meta.middlewares) {
        meta.middlewares = [];
      }

      if (!middleware) {
        throw new Error(
          `Middleware ${String(
            middleware,
          )} not found, are you sure you defined it before using it?`,
        );
      }

      if (!Array.isArray(middleware)) {
        middleware = [middleware];
      }

      meta.middlewares.push(...middleware);
      MetadataStore.set(target.prototype, "__class__", meta);
      return target;
    }

    // Method decorator usage
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [] };
    }

    if (!meta.middlewares) {
      meta.middlewares = [];
    }

    if (!Array.isArray(middleware)) {
      middleware = [middleware];
    }

    meta.middlewares.push(...middleware);
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
