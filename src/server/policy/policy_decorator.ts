import { MetadataStore } from "../../metadata_store";
import type { PolicyManager } from "./policy_manager";
import type {
  PolicyDecorator,
  PolicyMetadata,
  PolicyProvider,
} from "./policy_types";

export const createPolicyDecorator = <T extends Record<string, PolicyProvider>>(
  _manager: PolicyManager<T>,
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
      const policyMeta: PolicyMetadata = { scope, handler };

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
