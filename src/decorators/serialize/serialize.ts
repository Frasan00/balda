import type { SerializeOptions } from "src/decorators/serialize/serialize_types";
import { MetadataStore } from "src/metadata_store";
import type { Response } from "src/server/http/response";
import { validateSchema } from "src/validator/validator";
import { ZodError, type ZodType } from "zod";

const SERIALIZE_WRAPPED = Symbol("serializeWrapped");
const SERIALIZE_METADATA = Symbol("serializeMetadata");

export const serialize = <T extends ZodType>(
  schema: T,
  options?: SerializeOptions,
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let meta = MetadataStore.get(target, propertyKey) || {
      middlewares: [],
      route: {},
    };
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
      name: propertyKey,
      schema,
      safe: options?.safe ?? true,
    };

    if (!descriptor.value[SERIALIZE_WRAPPED]) {
      const originalMethod = descriptor.value;
      const wrappedFunction = async function (this: any, ...args: any[]) {
        const res = args[1] as Response;
        await originalMethod.apply(this, args);
        const actualStatus = res.responseStatus;

        const serializeMetadata = wrappedFunction[SERIALIZE_METADATA];
        const schema = serializeMetadata?.[actualStatus]?.schema;
        const safe = serializeMetadata?.[actualStatus]?.safe ?? true;

        if (schema && !safe) {
          const body = res.getBody();
          try {
            res.send(validateSchema(schema, body, safe));
          } catch (error) {
            if (error instanceof ZodError) {
              res.internalServerError({
                received: body,
                schema,
                error,
              });
              return;
            }

            throw error;
          }
        }
      };

      wrappedFunction[SERIALIZE_WRAPPED] = true;
      wrappedFunction[SERIALIZE_METADATA] = originalMethod[SERIALIZE_METADATA];
      descriptor.value = wrappedFunction;
    }
  };
};
