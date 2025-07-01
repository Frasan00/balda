import type { TSchema } from "@sinclair/typebox";

export interface CustomValidationError {
  status?: number;
  message?: string;
}

export interface ValidationOptions {
  /**
   * The schema to validate the request body against
   */
  body?: TSchema;
  /**
   * The schema to validate the query parameters against
   */
  query?: TSchema;
  /**
   * The schema to validate both body and query against
   */
  all?: TSchema;
  /**
   * Whether to use safe validation (returns original data if validation fails instead of throwing)
   * @default false
   */
  safe?: boolean;
}
