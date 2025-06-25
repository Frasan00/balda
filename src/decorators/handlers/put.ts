import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a PUT request
 */
export const put = (path: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "PUT" } };
    }

    meta.path = path;
    meta.method = "PUT";
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
