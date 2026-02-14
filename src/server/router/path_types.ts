import type { Static, TSchema } from "@sinclair/typebox";
import type { z, ZodType } from "zod";
import type { RequestSchema } from "../../decorators/validation/validate_types.js";

/**
 * Extracts parameter names from a path string and creates a typed object
 * @example ExtractParams<"/users/:id/posts/:postId"> → { id: string; postId: string }
 */
export type ExtractParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>;

/**
 * Helper type to infer the output type from a Zod schema, TypeBox schema, or any schema with _output
 */
export type InferSchemaType<T> = T extends ZodType
  ? z.infer<T>
  : T extends TSchema
    ? Static<T>
    : any;

/**
 * Maps a responses object (e.g. { 200: ZodSchema, 404: TypeBoxSchema }) to
 * an inferred type map (e.g. { 200: InferredType200, 404: InferredType404 }).
 */
export type InferResponseMap<T extends Record<number, RequestSchema>> = {
  [K in keyof T]: InferSchemaType<T[K]>;
};

/**
 * Extracts the body type for a specific HTTP status code from a response map.
 * Defaults to `any` when the status code is not present in the map.
 */
export type ResponseBodyForStatus<
  TMap,
  TStatus extends number,
> = TStatus extends keyof TMap ? TMap[TStatus] : any;
