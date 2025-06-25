import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a GET request
 */
export const get = (path: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "GET" } };
    }

    meta.route = { path, method: "GET" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
