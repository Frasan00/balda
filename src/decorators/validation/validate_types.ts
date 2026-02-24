import type { Static, TSchema } from "@sinclair/typebox";
import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { z, ZodType } from "zod";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";

// Since those are peer dependencies we ensure they exist to avoid type issues
type IsAny<T> = 0 extends 1 & T ? true : false;

type SafeTSchema = IsAny<TSchema> extends true ? never : TSchema;
type SafeJSONSchema = IsAny<JSONSchema> extends true ? never : JSONSchema;
type SafeZodType = IsAny<ZodType> extends true ? never : ZodType;

export type RequestSchema = SafeZodType | SafeTSchema | AjvCompileParams[0];

export type ValidatedData<T extends RequestSchema> = T extends SafeZodType
  ? z.infer<T>
  : T extends SafeTSchema
    ? Static<T>
    : T extends SafeJSONSchema
      ? SafeJSONSchema extends T
        ? Record<string, unknown>
        : FromSchema<T>
      : unknown;

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
