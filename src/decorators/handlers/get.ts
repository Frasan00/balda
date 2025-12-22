import { MetadataStore } from "../../metadata_store.js";
import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { ExtractParams } from "../../server/router/path_types.js";

/**
 * Decorator to mark a handler for a GET request with type-safe path parameters and response body
 * GET requests cannot have a request body (by HTTP spec)
 * Body and query must be validated with @validate decorators to be typed
 * @param path - The path of the route (path parameters will be automatically inferred)
 * @param options - The options for the route
 * @warning Must receive the request and response as the first two arguments or it might not work as expected.
 * @example
 * ```ts
 * import { get, controller, validate, Request, Response } from "balda";
 * import { z } from "zod";
 *
 * const UserQuerySchema = z.object({ include: z.string().optional() });
 * type UserQuery = z.infer<typeof UserQuerySchema>;
 * type UserResponse = { id: string; name: string };
 *
 * @controller("/api")
 * class MyController {
 *   @get("/:id")
 *   @validate.query(UserQuerySchema)
 *   async handler(
 *     req: Request<{ id: string }>,
 *     res: Response<UserResponse>,
 *     query: UserQuery  // ✅ Validated and typed!
 *   ) {
 *     const { id } = req.params; // ✅ id is typed as string!
 *     const { include } = query; // ✅ query is validated and typed!
 *     res.json({ id, name: "John" });
 *   }
 * }
 * ```
 */
export const get = <TPath extends string = string>(
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
      meta = { middlewares: [], route: { path, method: "GET" } };
    }

    meta.documentation = {
      ...(meta.documentation || {}),
      name: propertyKey,
      ...options,
    };

    meta.route = { path, method: "GET" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
