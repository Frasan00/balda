import { MetadataStore } from "../../metadata_store.js";
import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { ExtractParams } from "../../server/router/path_types.js";

/**
 * Decorator to mark a handler for a DELETE request with type-safe path parameters and response body
 * DELETE requests cannot have a request body (by HTTP spec)
 * Query params must be validated with @validate decorators to be typed
 * @param path - The path of the route (path parameters will be automatically inferred)
 * @param options - The options for the route
 * @warning Must receive the request and response as the first two arguments or it might not work as expected.
 * @example
 * ```ts
 * import { del, controller, Request, Response } from "balda";
 *
 * type DeletedResponse = { id: string; deleted: boolean };
 *
 * @controller("/api")
 * class MyController {
 *   @del("/:id")
 *   async handler(
 *     req: Request<{ id: string }>,
 *     res: Response<DeletedResponse>
 *   ) {
 *     const { id } = req.params; // ✅ id is typed as string!
 *     res.json({ id, deleted: true });
 *   }
 * }
 * ```
 */
export const del = <TPath extends string = string>(
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
      meta = { middlewares: [], route: { path, method: "DELETE" } };
    }

    meta.documentation = {
      ...(meta.documentation || {}),
      name: propertyKey,
      ...options,
    };

    meta.route = { path, method: "DELETE" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
