import { MetadataStore } from "../../metadata_store";

/**
 * Decorator to mark an handler for a PATCH request
 */
export const patch = (path: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "PATCH" } };
    }

    meta.path = path;
    meta.method = "PATCH";
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
