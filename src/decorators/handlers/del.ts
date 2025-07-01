import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { MetadataStore } from "../../metadata_store";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

type DelHandler = (req: Request, res: Response, ...args: any[]) => any;

/**
 * Decorator to mark an handler for a DELETE request
 * @param path - The path of the route
 * @param options - The options for the route
 * @warning Must receive the request and response as the first two arguments or it might not work as expected.
 * @example
 * ```ts
 * import { del, controller, Request, Response } from "balda";
 *
 * @controller("/api")
 * class MyController {
 *   @del("/")
 *   async handler(req: Request, res: Response) {
 *     // ...
 *   }
 * }
 * ```
 */
export const del = (path: string, options?: SwaggerRouteOptions) => {
  return <T extends DelHandler>(
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
