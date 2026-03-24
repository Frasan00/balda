import type { ErrorObject } from "ajv";
import type {
  RequestSchema,
  ValidatedData,
} from "../../decorators/validation/validate_types.js";
import type { Request } from "../http/request.js";

/**
 * The serialized validation error object passed to the map function.
 * This is the JSON-serializable shape of AJV's ValidationError.
 */
export interface SerializedValidationError {
  message: string;
  errors: ErrorObject[];
  ajv: true;
  validation: true;
}

/**
 * Configuration for custom validation error handling.
 * Replaces the default 422 response with a custom status and body shape.
 *
 * @template T - The schema type (Zod, TypeBox, or JSON Schema). When provided,
 *               the map function return type is inferred as ValidatedData<T>.
 */
export interface ValidationErrorHandlerOptions<
  T extends RequestSchema = RequestSchema,
> {
  /** HTTP status code for the response. Default: 422 */
  status?: number;

  /**
   * Zod/TypeBox/JSON schema for the response body.
   * Used for Swagger documentation and type inference for map return type.
   */
  schema?: T;

  /**
   * Transform AJV errors to your custom response shape.
   * Required if schema is provided.
   * @param error - The validation error object with AJV ErrorObject array
   * @param req - The request object (for path, method, headers, etc.)
   * @returns The response body to send. When schema is provided, return type is ValidatedData<T>.
   *          Can be async (return Promise) for asynchronous transformations.
   */
  map?: (
    error: SerializedValidationError,
    req: Request,
  ) => ValidatedData<T> | Promise<ValidatedData<T>>;
}

let globalValidationErrorHandler: ValidationErrorHandlerOptions | null = null;

/**
 * Register a custom validation error handler.
 * Replaces the default 422 response with a custom status and body.
 * @param options - Configuration object with status, schema, and map function
 * @throws Error if schema is provided without map function
 */
export function setValidationErrorHandler<
  T extends RequestSchema = RequestSchema,
>(options: ValidationErrorHandlerOptions<T>): void {
  if (options.schema && !options.map) {
    throw new Error(
      "setValidationErrorHandler: 'map' function is required when 'schema' is provided. " +
        "The schema defines the response shape, so 'map' must transform AJV errors to match it.",
    );
  }

  globalValidationErrorHandler = options as ValidationErrorHandlerOptions<any>;
}

/**
 * Get the current validation error handler options.
 * @internal
 */
export function getValidationErrorHandler(): ValidationErrorHandlerOptions | null {
  return globalValidationErrorHandler;
}

/**
 * Reset the validation error handler (for testing).
 * @internal
 */
export function resetValidationErrorHandler(): void {
  globalValidationErrorHandler = null;
}
