import type { TSchema } from "@sinclair/typebox";
import type { SerializeOptions } from "src/decorators/serialize/serialize_types";
import type { Response } from "src/server/http/response";
import { MetadataStore } from "src/metadata_store";
import { validateSchema } from "src/validator/validator";

/**
 * Decorator to serialize the response body using TypeBox schemas.
 * Does not throw an error if the response body is not valid unless the `safe` option is set to `false`.
 * Also updates the documentation to reflect the schema.
 * @param schema - The schema to serialize the response body against.
 * @param options - The options to serialize the response body against.
 */
export const serialize = (schema: TSchema, options?: SerializeOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: {} };
    }

    if (!meta.documentation) {
      meta.documentation = {};
    }

    meta.documentation.responses = {
      [Number(options?.status ?? 200)]: schema,
      ...meta.documentation.responses,
    };

    MetadataStore.set(target, propertyKey, meta);

    descriptor.value = async function (...args: any[]) {
      const res = args[1] as Response;

      await originalMethod.apply(this, args);
      // Overrides the response body with the validated schema
      res.send(validateSchema(schema, res.getBody(), options?.safe ?? true));
    };
  };
};
