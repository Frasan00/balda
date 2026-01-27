import { MetadataStore } from "../../metadata_store.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type {
  CustomValidationError,
  RequestSchema,
  ValidationOptions,
} from "./validate_types.js";

/**
 * Decorator to validate request data using Zod, TypeBox, or plain JSON schemas.
 * Each validate method injects a new parameter to the handler function with the validated data. Arguments are injected in the order of the validate methods.
 * Using this decorator will also update the Swagger documentation with the validated schema (except for the .all schema since there is no way to if using query strings or body).
 * @param options - Validation options including body, query, or all schemas
 * @warning If validation fails, a 400 error will be returned with the validation errors to the client.
 * @warning Only synchronous Zod schemas are supported. Async refinements or transforms will throw an error.
 * @example Zod Schema
 * ```ts
 * import { validate } from "./validate.js";
 * import { controller, post } from "../handlers/post.js";
 * import { Request } from "../../server/http/request.js";
 * import { Response } from "../../server/http/response.js";
 * import { z } from "zod";
 *
 * const PayloadSchema = z.object({
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * @controller("/users")
 * export class UserController {
 *   @post("/")
 *   @validate.body(PayloadSchema)
 *   async createUser(req: Request, res: Response, payload: ValidatedData<typeof PayloadSchema>) {
 *     // payload is now validated and typed
 *     const { name, email } = payload;
 *   }
 * }
 * ```
 *
 * @example TypeBox Schema
 * ```ts
 * import { Type, Static } from "@sinclair/typebox";
 *
 * const PayloadSchema = Type.Object({
 *   name: Type.String(),
 *   email: Type.String({ format: "email" }),
 * });
 *
 * @post("/")
 * @validate.body(PayloadSchema)
 * async createUser(req: Request, res: Response, payload: Static<typeof PayloadSchema>) {
 *   const { name, email } = payload;
 * }
 * ```
 */
const validateDecorator = (
  options: ValidationOptions & { customError?: CustomValidationError },
) => {
  // Schemas will be compiled lazily on first request via Request.compileAndValidate
  // This avoids compilation errors at decorator evaluation time

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

    if (options.all) {
      meta.documentation.requestBody = options.body;
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
        if (options.customError) {
          return res.status(options.customError.status || 400).json({
            received: req.body,
            schema: options.body,
            error,
          });
        }

        return res.badRequest(error);
      }
    };

    return descriptor;
  };
};

/**
 * Decorator to validate the query parameters against a Zod schema or OpenAPI schema
 * @param schema - The schema to validate the query parameters against (Zod, TypeBox, or plain JSON schema)
 * @returns The decorator function
 */
validateDecorator.query = (
  schema: RequestSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ query: schema, customError });
};

/**
 * Decorator to validate the request body against a Zod schema
 * @param schema - The schema to validate the request body against (Zod, TypeBox, or plain JSON schema)
 * @returns The decorator function
 */
validateDecorator.body = (
  schema: RequestSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ body: schema, customError });
};

/**
 * Decorator to validate both the request body and query parameters against a Zod schema
 * @param schema - The schema to validate both the request body and query parameters against (Zod, TypeBox, or plain JSON schema)
 * @returns The decorator function
 */
validateDecorator.all = (
  schema: RequestSchema,
  customError?: CustomValidationError,
) => {
  return validateDecorator({ all: schema, customError });
};

export const validate = validateDecorator;
