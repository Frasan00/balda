import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";

type IsAny<T> = 0 extends 1 & T ? true : false;

// Structural shapes for optional peer dependency schemas (zod, @sinclair/typebox).
// Using structural matching instead of direct imports avoids module resolution
// failures when a peer dependency is not installed.
// json-schema-to-ts requires a direct import for FromSchema (complex type-level
// computation that cannot be replicated structurally); IsAny guards the missing case.
type ZodSchemaLike = { _zod: { output: any } };
type TypeBoxSchemaLike = { static: any; params: any };
type SafeJSONSchema = IsAny<JSONSchema> extends true ? never : JSONSchema;

export type RequestSchema =
  | ZodSchemaLike
  | TypeBoxSchemaLike
  | AjvCompileParams[0];

export type ValidatedData<T extends RequestSchema> = T extends {
  _zod: { output: infer O };
}
  ? O
  : T extends { static: infer O }
    ? O
    : T extends SafeJSONSchema
      ? SafeJSONSchema extends T
        ? Record<string, unknown>
        : FromSchema<T>
      : Record<string, unknown>;

export interface CustomValidationError {
  status?: number;
  message?: string;
}

export interface ValidationOptions {
  /**
   * The schema to validate the request body against (Zod, TypeBox, or plain JSON schema)
   */
  body?: RequestSchema;
  /**
   * The schema to validate the query parameters against (Zod, TypeBox, or plain JSON schema)
   */
  query?: RequestSchema;
  /**
   * The schema to validate both body and query against (Zod, TypeBox, or plain JSON schema)
   */
  all?: RequestSchema;
  /**
   * Whether to throw an error on validation failure (returns 400 response with validation errors)
   * @default true
   */
  throwOnValidationFail?: boolean;
}
