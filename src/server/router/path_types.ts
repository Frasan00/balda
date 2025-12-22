import type { Static, TSchema } from "@sinclair/typebox";
import type { z, ZodAny } from "zod";

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
export type InferSchemaType<T> = T extends ZodAny
  ? z.infer<T>
  : T extends TSchema
    ? Static<T>
    : T;
