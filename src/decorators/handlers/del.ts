import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a DELETE request
 */
export const del = (path: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "DELETE" } };
    }

    meta.path = path;
    meta.method = "DELETE";
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
