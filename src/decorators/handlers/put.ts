import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a PUT request
 */
export const put = (path: string, options?: SwaggerRouteOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "PUT" } };
    }

    if (options) {
      meta.documentation = options;
    }

    meta.route = { path, method: "PUT" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
