import type { TSchema } from "@sinclair/typebox";
import type { SerializeOptions } from "src/decorators/serialize/serialize_types";
import { MetadataStore } from "src/metadata_store";
import type { Response } from "src/server/http/response";
import { validateSchema } from "src/validator/validator";

const SERIALIZE_WRAPPED = Symbol("serializeWrapped");
const SERIALIZE_METADATA = Symbol("serializeMetadata");

export const serialize = (schema: TSchema, options?: SerializeOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey) || { middlewares: [], route: {} };
    if (!meta.documentation) {
      meta.documentation = {};
    }
    if (!meta.documentation.responses) {
      meta.documentation.responses = {};
    }
    if (!meta.serializeOptions) {
      meta.serializeOptions = {};
    }

    const status = Number(options?.status ?? 200);
    meta.documentation.responses[status] = schema;
    meta.serializeOptions[status] = options?.safe ?? true;
    MetadataStore.set(target, propertyKey, meta);

    if (!descriptor.value[SERIALIZE_METADATA]) {
      descriptor.value[SERIALIZE_METADATA] = {};
    }

    descriptor.value[SERIALIZE_METADATA][status] = {
      schema,
      safe: options?.safe ?? true
    };

    if (!descriptor.value[SERIALIZE_WRAPPED]) {
      const originalMethod = descriptor.value;
      descriptor.value = async function (...args: any[]) {
        const res = args[1] as Response;
        await originalMethod.apply(this, args);
        const actualStatus = res.responseStatus;

        const serializeMetadata = originalMethod[SERIALIZE_METADATA];
        const schema = serializeMetadata?.[actualStatus]?.schema;
        const safe = serializeMetadata?.[actualStatus]?.safe ?? true;

        if (schema && !safe) {
          res.send(validateSchema(schema, res.getBody(), safe));
        }
      };

      descriptor.value[SERIALIZE_WRAPPED] = true;
      descriptor.value[SERIALIZE_METADATA] = originalMethod[SERIALIZE_METADATA];
    }
  };
};
