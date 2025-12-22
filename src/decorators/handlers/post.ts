import { MetadataStore } from "../../metadata_store.js";
import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { ExtractParams } from "../../server/router/path_types.js";

/**
 * Decorator to mark a handler for a POST request with type-safe path parameters and response body
 * Body and query must be validated with @validate decorators to be typed
 * @param path - The path of the route (path parameters will be automatically inferred)
 * @param options - The options for the route
 * @warning Must receive the request and response as the first two arguments or it might not work as expected.
 * @example
 * ```ts
 * import { post, controller, validate, Request, Response } from "balda";
 * import { z } from "zod";
 *
 * const CreateUserSchema = z.object({ name: z.string(), email: z.string().email() });
 * type CreateUserInput = z.infer<typeof CreateUserSchema>;
 * type CreatedResponse = { id: string; created: boolean };
 *
 * @controller("/api")
 * class MyController {
 *   @post("/")
 *   @validate.body(CreateUserSchema)
 *   async handler(
 *     req: Request<{}>,
 *     res: Response<CreatedResponse>,
 *     body: CreateUserInput  // ✅ Validated and typed!
 *   ) {
 *     const { name, email } = body; // ✅ body is validated and typed!
 *     res.json({ id: "123", created: true });
 *   }
 * }
 * ```
 */
export const post = <TPath extends string = string>(
  path: TPath,
  options?: SwaggerRouteOptions,
) => {
  return <
    T extends (
      req: Request<ExtractParams<TPath>>,
      res: Response,
      ...args: any[]
    ) => any,
  >(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): TypedPropertyDescriptor<T> => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "POST" } };
    }

    meta.documentation = {
      ...(meta.documentation || {}),
      name: propertyKey,
      ...options,
    };

    meta.route = { path, method: "POST" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
