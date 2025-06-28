import type { TSchema } from "@sinclair/typebox";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import { ValidationError } from "ajv";

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

/**
 * Decorator to validate request data using TypeBox schemas
 * @param options - Validation options including body, query, or all schemas
 * @warning If validation fails, a 400 error will be returned with the validation errors to the client.
 * @example
 * ```ts
 * @controller("/users")
 * export class UserController {
 *   @post("/")
 *   @validate({ body: UserSchema })
 *   async createUser(req: Request, res: Response) {
 *     // req.body is now validated and typed
 *     const user = req.body; // TypeScript knows this is User type
 *     // ... rest of handler
 *   }
 * }
 * ```
 */
const validateDecorator = (
  options: ValidationOptions & { customError?: CustomValidationError }
) => {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0] as Request;
      const res = args[1] as Response;

      try {
        if (options.body) {
          req.validate(options.body, options.safe);
        }

        if (options.query) {
          req.validateQuery(options.query, options.safe);
        }

        if (options.all) {
          req.validateAll(options.all, options.safe);
        }

        return originalMethod.apply(this, args);
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error;
        }

        if (options.customError) {
          return res.status(options.customError.status || 400).json({
            message: options.customError.message || error.message,
          });
        }

        return res.badRequest(error);
      }
    };

    return descriptor;
  };
};

/**
 * Decorator to validate the query parameters against a TypeBox schema
 * @param schema - The TypeBox schema to validate the query parameters against
 * @returns The decorator function
 */
validateDecorator.query = (schema: TSchema, customError?: CustomValidationError) => {
  return validateDecorator({ query: schema, customError });
};

/**
 * Decorator to validate the request body against a TypeBox schema
 * @param schema - The TypeBox schema to validate the request body against
 * @returns The decorator function
 */
validateDecorator.body = (schema: TSchema, customError?: CustomValidationError) => {
  return validateDecorator({ body: schema, customError });
};

/**
 * Decorator to validate both the request body and query parameters against a TypeBox schema
 * @param schema - The TypeBox schema to validate both the request body and query parameters against
 * @returns The decorator function
 */
validateDecorator.all = (schema: TSchema, customError?: CustomValidationError) => {
  return validateDecorator({ all: schema, customError });
};

export const validate = validateDecorator;
