import { MetadataStore } from "../../metadata_store.js";
import type { PolicyManager } from "./policy_manager.js";
import type {
  PolicyDecorator,
  PolicyMetadata,
  PolicyProvider,
} from "./policy_types.js";

export const createPolicyDecorator = <T extends Record<string, PolicyProvider>>(
  manager: PolicyManager<T>,
): PolicyDecorator<T> => {
  return <S extends keyof T & string, H extends keyof T[S] & string>(
    scope: S,
    handler: H,
  ) => {
    return (
      target: any,
      propertyKey?: string,
      descriptor?: PropertyDescriptor,
    ) => {
      const policyMeta: PolicyMetadata = { scope, handler, manager };

      if (typeof propertyKey === "undefined") {
        let meta = MetadataStore.get(target.prototype, "__class__");
        if (!meta) {
          meta = { policies: [] };
        }

        if (!meta.policies) {
          meta.policies = [];
        }

        meta.policies.push(policyMeta);
        MetadataStore.set(target.prototype, "__class__", meta);
        return target;
      }

      let meta = MetadataStore.get(target, propertyKey);
      if (!meta) {
        meta = { policies: [] };
      }

      if (!meta.policies) {
        meta.policies = [];
      }

      meta.policies.push(policyMeta);
      MetadataStore.set(target, propertyKey, meta);
      return descriptor;
    };
  };
};
