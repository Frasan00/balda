import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";
import type { SyncOrAsync } from "../../type_util.js";

/**
 * Custom handler invoked when request validation fails.
 * When set, replaces the default `res.badRequest(error)` response.
 */
export type ValidationErrorHandler = (
  req: Request,
  res: Response,
  error: unknown,
) => SyncOrAsync;

let globalValidationErrorHandler: ValidationErrorHandler | null = null;

/**
 * Register a custom global handler for validation errors.
 * Called by `server.setValidationErrorHandler()`.
 * @internal
 */
export function setValidationErrorHandler(
  handler: ValidationErrorHandler,
): void {
  globalValidationErrorHandler = handler;
}

/**
 * Get the current global validation error handler (or null for the default).
 * @internal
 */
export function getValidationErrorHandler(): ValidationErrorHandler | null {
  return globalValidationErrorHandler;
}

/**
 * Reset the global validation error handler (for testing).
 * @internal
 */
export function resetValidationErrorHandler(): void {
  globalValidationErrorHandler = null;
}
