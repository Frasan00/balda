import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import type { ServerRouteHandler } from "../../runtime/native_server/server_types.js";
import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";

/**
 * Wraps a route handler with validation logic for body, query, or all request data.
 * Similar to the @validate decorator but for inline route definitions.
 *
 * @param handler - The original route handler
 * @param options - Validation schemas for body, query, or all
 * @returns Wrapped handler that validates and injects typed parameters
 */
export const wrapHandlerWithValidation = (
  handler: ServerRouteHandler,
  options: {
    body?: RequestSchema;
    query?: RequestSchema;
    all?: RequestSchema;
  },
): ServerRouteHandler => {
  return async function (req: Request, res: Response, ...args: any[]) {
    try {
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
    } catch (error) {
      return res.badRequest(error);
    }
  };
};
