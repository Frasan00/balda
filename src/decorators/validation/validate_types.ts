import type { ZodType } from "zod";
import type { AjvCompileParams } from "../../ajv/ajv_types.js";

export interface CustomValidationError {
  status?: number;
  message?: string;
}

export interface ValidationOptions {
  /**
   * The schema to validate the request body against (Zod schema or OpenAPI schema)
   */
  body?: ZodType | AjvCompileParams[0];
  /**
   * The schema to validate the query parameters against (Zod schema or OpenAPI schema)
   */
  query?: ZodType | AjvCompileParams[0];
  /**
   * The schema to validate both body and query against (Zod schema or OpenAPI schema)
   */
  all?: ZodType | AjvCompileParams[0];
  /**
   * Whether to use safe validation (returns original data if validation fails instead of throwing)
   * @default false
   */
  safe?: boolean;
}
