import type {
  RequestSchema,
  ValidatedData,
} from "../decorators/validation/validate_types.js";
import { ZodLoader } from "../validator/zod_loader.js";
import { TypeBoxLoader } from "../validator/typebox_loader.js";
import { AjvStateManager } from "../ajv/ajv.js";
import { validateSchema } from "../validator/validator.js";
import type { SerializerBuilder, VariantConfig } from "./serializer_types.js";

class SerializerBuilderImpl<
  TInput,
  TDeclaredVariants extends string,
  TVariantMap extends Record<string, unknown>,
  TCtx,
> implements SerializerBuilder<TInput, TDeclaredVariants, TVariantMap, TCtx> {
  constructor(
    private readonly variants: Map<
      string,
      VariantConfig<TInput, TCtx>
    > = new Map(),
  ) {}

  defineVariant<const TName extends string, TOutput>(
    name: TName,
    handler: (input: TInput, ctx?: TCtx) => TOutput | Promise<TOutput>,
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, TOutput>,
    TCtx
  >;
  defineVariant<const TName extends string, TSchema extends RequestSchema>(
    name: TName,
    schema: TSchema,
    handler: (
      input: TInput,
      ctx?: TCtx,
    ) => ValidatedData<TSchema> | Promise<ValidatedData<TSchema>>,
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, ValidatedData<TSchema>>,
    TCtx
  >;
  defineVariant<const TName extends string, TSchema extends RequestSchema>(
    name: TName,
    handler: (input: TInput, ctx?: TCtx) => unknown,
    schema: TSchema,
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, ValidatedData<TSchema>>,
    TCtx
  >;
  defineVariant(
    ...args: unknown[]
  ): SerializerBuilder<TInput, string, Record<string, unknown>, TCtx> {
    const [name, arg2, arg3] = args as [
      string,
      RequestSchema | ((input: TInput, ctx?: TCtx) => unknown),
      ((input: TInput, ctx?: TCtx) => unknown) | RequestSchema | undefined,
    ];

    const newVariants = new Map(this.variants) as Map<
      string,
      VariantConfig<TInput, TCtx>
    >;

    if (!arg3) {
      const resolvedHandler =
        typeof arg2 === "function"
          ? (arg2 as (input: TInput, ctx?: TCtx) => unknown)
          : undefined!;
      const resolvedSchema =
        typeof arg2 === "function" ? undefined : (arg2 as RequestSchema);
      newVariants.set(name, {
        handler: resolvedHandler,
        schema: resolvedSchema,
      });
    } else if (typeof arg2 === "function" && typeof arg3 !== "function") {
      newVariants.set(name, {
        handler: arg2 as (input: TInput, ctx?: TCtx) => unknown,
        schema: arg3 as RequestSchema,
      });
    } else {
      newVariants.set(name, {
        handler: arg3 as (input: TInput, ctx?: TCtx) => unknown,
        schema: arg2 as RequestSchema,
      });
    }

    return new SerializerBuilderImpl(
      newVariants,
    ) as unknown as SerializerBuilder<
      TInput,
      string,
      Record<string, unknown>,
      TCtx
    >;
  }

  async useVariant<TName extends TDeclaredVariants>(
    name: TName,
    data: TInput,
    options?: { ctx?: TCtx; validate?: boolean },
  ): Promise<TVariantMap[TName]> {
    const config = this.variants.get(name);
    if (!config) {
      const names = Array.from(this.variants.keys()).join(", ") || "(none)";
      throw new Error(
        `Serializer variant "${name}" is not defined. Defined variants: ${names}`,
      );
    }

    const ctx = options?.ctx;
    const shouldValidate = options?.validate ?? false;

    const result = await config.handler(data, ctx);

    if (shouldValidate && config.schema) {
      return validateOutput(config.schema, result) as Promise<
        TVariantMap[TName]
      >;
    }

    return result as TVariantMap[TName];
  }
}

const validateOutput = async (
  schema: RequestSchema,
  data: unknown,
): Promise<unknown> => {
  if (ZodLoader.isZodSchema(schema)) {
    return schema.parse(data);
  }

  if (TypeBoxLoader.isTypeBoxSchema(schema)) {
    const { Value } = await import("@sinclair/typebox/value");
    if (!Value.Check(schema, data)) {
      const errors = Array.from(Value.Errors(schema, data));
      throw new Error(
        `Serializer validation failed:\n${errors.map((e) => `  - ${e.message} at ${e.path}`).join("\n")}`,
      );
    }
    return Value.Cast(schema, data);
  }

  const validator = AjvStateManager.getOrCompileValidator(
    schema as Record<string, unknown>,
    "serializer_json",
  );
  return validateSchema(validator, data, true);
};

export function serializer<
  TSchema extends RequestSchema,
  TCtx extends RequestSchema | undefined = undefined,
>(
  inputSchema: TSchema,
  ctxSchema?: TCtx,
): SerializerBuilder<
  ValidatedData<TSchema>,
  never,
  {},
  TCtx extends RequestSchema ? ValidatedData<TCtx> : unknown
>;
export function serializer<
  TInput = unknown,
  TCtx = unknown,
>(): SerializerBuilder<TInput, never, {}, TCtx>;
export function serializer<TInput = unknown, TCtx = unknown>(
  inputSchema?: TInput,
  ctxSchema?: TCtx,
): SerializerBuilder<unknown, never, {}, TCtx> {
  void inputSchema;
  void ctxSchema;

  return new SerializerBuilderImpl() as SerializerBuilder<
    unknown,
    never,
    {},
    TCtx
  >;
}
