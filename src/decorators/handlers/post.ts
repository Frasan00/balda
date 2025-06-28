import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a POST request
 */
export const post = (path: string, options?: SwaggerRouteOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "POST" } };
    }

    meta.documentation = {
      ...(meta.documentation || {}),
      name: propertyKey,
      ...options,
    };

    meta.route = { path, method: "POST" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
