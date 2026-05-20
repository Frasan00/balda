import type {
  RequestSchema,
  ValidatedData,
} from "../decorators/validation/validate_types.js";

export type VariantHandler<TInput, TOutput, TCtx = unknown> = (
  input: TInput,
  ctx?: TCtx,
) => TOutput | Promise<TOutput>;

export interface VariantConfig<TInput = unknown, TCtx = unknown> {
  handler: VariantHandler<TInput, unknown, TCtx>;
  schema?: RequestSchema;
}

export interface SerializerBuilder<
  TInput,
  TDeclaredVariants extends string,
  TVariantMap extends Record<string, unknown>,
  TCtx = unknown,
> {
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

  defineVariant<const TName extends string, TOutput>(
    name: TName,
    handler: (input: TInput, ctx?: TCtx) => TOutput | Promise<TOutput>,
  ): SerializerBuilder<
    TInput,
    TDeclaredVariants | TName,
    TVariantMap & Record<TName, TOutput>,
    TCtx
  >;

  useVariant<TName extends TDeclaredVariants>(
    name: TName,
    data: TInput,
    options?: { ctx?: TCtx; validate?: boolean },
  ): Promise<TVariantMap[TName]>;
}
