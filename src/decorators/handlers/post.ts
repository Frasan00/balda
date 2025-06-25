import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a POST request
 */
export const post = (path: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "POST" } };
    }

    meta.route = { path, method: "POST" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
