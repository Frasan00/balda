import type { ZodType } from "zod";

export interface CustomValidationError {
  status?: number;
  message?: string;
}

export interface ValidationOptions {
  /**
   * The schema to validate the request body against
   */
  body?: ZodType;
  /**
   * The schema to validate the query parameters against
   */
  query?: ZodType;
  /**
   * The schema to validate both body and query against
   */
  all?: ZodType;
  /**
   * Whether to use safe validation (returns original data if validation fails instead of throwing)
   * @default false
   */
  safe?: boolean;
}
