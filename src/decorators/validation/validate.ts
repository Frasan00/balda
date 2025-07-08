import type { TSchema } from "@sinclair/typebox";
import { ValidationError } from "ajv";
import { MetadataStore } from "../../metadata_store";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import type {
  CustomValidationError,
  ValidationOptions,
} from "./validate_types";

/**
 * Decorator to validate request data using TypeBox schemas.
 * Each validate method injects a new parameter to the handler function with the validated data. Arguments are injected in the order of the validate methods.
 * Using this decorator will also update the Swagger documentation with the validated schema (except for the .all schema since there is no way to if using query strings or body).
 * @param options - Validation options including body, query, or all schemas
 * @warning If validation fails, a 400 error will be returned with the validation errors to the client.
 * @example
 * ```ts
 * import { validate } from "src/decorators/validation/validate";
 * import { controller, post } from "src/decorators/handlers/post";
 * import { Request } from "src/server/http/request";
 * import { Response } from "src/server/http/response";
 * import { Type } from "@sinclair/typebox";
 *
 * const PayloadSchema = Type.Object({
 *   name: Type.String(),
 *   email: Type.String(),
 * });
 *
 * @controller("/users")
 * export class UserController {
 *   @post("/")
 *   @validate.body(PayloadSchema) // This will also update the Swagger documentation with the validated schemas and will override the existing schemas.
 *   async createUser(req: Request, res: Response, payload: Static<typeof PayloadSchema>) {
 *     // payload is now validated and typed
 *     const { name, email } = payload;
 *   }
 * }
 * ```
 */
const validateDecorator = (
  options: ValidationOptions & { customError?: CustomValidationError },
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: {} };
    }

    if (!meta.documentation) {
      meta.documentation = {};
    }

    if (options.body) {
      meta.documentation.requestBody = options.body;
    }

    if (options.query) {
      meta.documentation.query = options.query;
    }

    MetadataStore.set(target, propertyKey, meta);

    descriptor.value = async function (...args: any[]) {
      const req = args[0] as Request;
      const res = args[1] as Response;

      try {
        let validatedBody: any = undefined;
        let validatedQuery: any = undefined;
        let validatedAll: any = undefined;

        if (options.body) {
          validatedBody = req.validate(options.body, options.safe);
        }

        if (options.query) {
          validatedQuery = req.validateQuery(options.query, options.safe);
        }

        if (options.all) {
          validatedAll = req.validateAll(options.all, options.safe);
        }

        const newArgs = [...args];
        if (validatedBody !== undefined) {
          newArgs.push(validatedBody);
        }
        if (validatedQuery !== undefined) {
          newArgs.push(validatedQuery);
        }
        if (validatedAll !== undefined) {
          newArgs.push(validatedAll);
        }

        return originalMethod.apply(this, newArgs);
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error;
        }

        if (options.customError) {
          return res.status(options.customError.status || 400).json({
            received: req.body,
            schema: options.body,
            error: error.errors,
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
validateDecorator.query = (
  schema: TSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ query: schema, customError });
};

/**
 * Decorator to validate the request body against a TypeBox schema
 * @param schema - The TypeBox schema to validate the request body against
 * @returns The decorator function
 */
validateDecorator.body = (
  schema: TSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ body: schema, customError });
};

/**
 * Decorator to validate both the request body and query parameters against a TypeBox schema
 * @param schema - The TypeBox schema to validate both the request body and query parameters against
 * @returns The decorator function
 */
validateDecorator.all = (
  schema: TSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ all: schema, customError });
};

export const validate = validateDecorator;
