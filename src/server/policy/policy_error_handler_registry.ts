import type {
  RequestSchema,
  ValidatedData,
} from "../../decorators/validation/validate_types.js";
import type { Request } from "../http/request.js";

/**
 * Configuration for custom policy error handling.
 * Replaces the default 401 response with a custom status and body shape.
 *
 * @template T - The schema type (Zod, TypeBox, or JSON Schema). When provided,
 *               the map function return type is inferred as ValidatedData<T>.
 */
export interface PolicyErrorHandlerOptions<
  T extends RequestSchema = RequestSchema,
> {
  /** HTTP status code for the response. Default: 401 */
  status?: number;

  /**
   * Zod/TypeBox/JSON schema for the response body.
   * Used for Swagger documentation and type inference for map return type.
   */
  schema?: T;

  /**
   * Transform policy error to your custom response shape.
   * Required if schema is provided.
   * @param req - The request object (for path, method, headers, user, etc.)
   * @returns The response body to send. When schema is provided, return type is ValidatedData<T>.
   *          Can be async (return Promise) for asynchronous transformations.
   */
  map?: (req: Request) => ValidatedData<T> | Promise<ValidatedData<T>>;
}

let globalPolicyErrorHandler: PolicyErrorHandlerOptions | null = null;

/**
 * Register a custom policy error handler.
 * Replaces the default 401 response with a custom status and body.
 * @param options - Configuration object with status, schema, and map function
 * @throws Error if schema is provided without map function
 */
export function setPolicyErrorHandler<T extends RequestSchema = RequestSchema>(
  options: PolicyErrorHandlerOptions<T>,
): void {
  if (options.schema && !options.map) {
    throw new Error(
      "setPolicyErrorHandler: 'map' function is required when 'schema' is provided. " +
        "The schema defines the response shape, so 'map' must return data matching it.",
    );
  }

  globalPolicyErrorHandler = options as PolicyErrorHandlerOptions<any>;
}

/**
 * Get the current policy error handler options.
 * @internal
 */
export function getPolicyErrorHandler(): PolicyErrorHandlerOptions | null {
  return globalPolicyErrorHandler;
}

/**
 * Reset the policy error handler (for testing).
 * @internal
 */
export function resetPolicyErrorHandler(): void {
  globalPolicyErrorHandler = null;
}
