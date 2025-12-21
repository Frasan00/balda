import type { z, ZodType } from "zod";
import type { Static, TSchema } from "@sinclair/typebox";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";

export type RequestSchema = ZodType | TSchema | AjvCompileParams[0];

export type ValidatedData<T extends RequestSchema> = T extends ZodType
  ? z.infer<T>
  : T extends TSchema
    ? Static<T>
    : T extends AjvCompileParams[0]
      ? any
      : any;

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
   * Whether to use safe validation (returns original data if validation fails instead of throwing)
   * @default false
   */
  safe?: boolean;
}
