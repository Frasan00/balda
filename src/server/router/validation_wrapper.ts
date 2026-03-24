import { ValidationError } from "ajv";
import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import type { ServerRouteHandler } from "../../runtime/native_server/server_types.js";
import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";
import {
  getValidationErrorHandler,
  type SerializedValidationError,
} from "./validation_error_handler_registry.js";

/**
 * Wraps a route handler with validation logic for body, query, headers, or all request data.
 * Similar to the @validate decorator but for inline route definitions.
 *
 * @param handler - The original route handler
 * @param options - Validation schemas for body, query, headers, or all
 * @returns Wrapped handler that validates and injects typed parameters
 */
export const wrapHandlerWithValidation = (
  handler: ServerRouteHandler,
  options: {
    body?: RequestSchema;
    query?: RequestSchema;
    headers?: RequestSchema;
    all?: RequestSchema;
  },
): ServerRouteHandler => {
  return async function (req: Request, res: Response, ...args: any[]) {
    try {
      if (options.headers) {
        const validatedHeaders = req.validateHeaders(options.headers, true);
        (req as any).headers = validatedHeaders;
      }

      if (options.body) {
        const validatedBody = req.validate(options.body, true);
        (req as any).body = validatedBody;
      }

      if (options.query) {
        const validatedQuery = req.validateQuery(options.query, true);
        (req as any).query = validatedQuery;
      }

      if (options.all) {
        const validatedAll = req.validateAll(options.all, true);
        (req as any).body = validatedAll;
      }

      return handler(req, res, ...args);
    } catch (error: unknown) {
      const customOptions = getValidationErrorHandler();

      if (error instanceof ValidationError) {
        const vError = error as ValidationError;
        const validationError: SerializedValidationError = {
          message: vError.message,
          errors: vError.errors as SerializedValidationError["errors"],
          ajv: true,
          validation: true,
        };

        if (customOptions) {
          const status = customOptions.status ?? 422;
          const body = customOptions.map
            ? await customOptions.map(validationError, req)
            : validationError;
          return res.status(status).json(body);
        }

        return res.unprocessableEntity(validationError);
      }

      const genericError: SerializedValidationError = {
        message: error instanceof Error ? error.message : String(error),
        errors: [],
        ajv: true,
        validation: true,
      };

      if (customOptions) {
        const status = customOptions.status ?? 422;
        const body = customOptions.map
          ? await customOptions.map(genericError, req)
          : genericError;
        return res.status(status).json(body);
      }
      return res.unprocessableEntity(error);
    }
  };
};
