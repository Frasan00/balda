import type { ZodType } from "zod";
import type { TSchema } from "@sinclair/typebox";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";

export interface CustomValidationError {
  status?: number;
  message?: string;
}

export interface ValidationOptions {
  /**
   * The schema to validate the request body against (Zod, TypeBox, or plain JSON schema)
   */
  body?: ZodType | TSchema | AjvCompileParams[0];
  /**
   * The schema to validate the query parameters against (Zod, TypeBox, or plain JSON schema)
   */
  query?: ZodType | TSchema | AjvCompileParams[0];
  /**
   * The schema to validate both body and query against (Zod, TypeBox, or plain JSON schema)
   */
  all?: ZodType | TSchema | AjvCompileParams[0];
  /**
   * Whether to use safe validation (returns original data if validation fails instead of throwing)
   * @default false
   */
  safe?: boolean;
}
