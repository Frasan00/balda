import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import { MetadataStore } from "../../metadata_store";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

type PutHandler = (req: Request, res: Response, ...args: any[]) => any;

/**
 * Decorator to mark an handler for a PUT request
 * @param path - The path of the route
 * @param options - The options for the route
 * @warning Must receive the request and response as the first two arguments or it might not work as expected.
 * @example
 * ```ts
 * import { put, controller, Request, Response } from "balda";
 *
 * @controller("/api")
 * class MyController {
 *   @put("/")
 *   async handler(req: Request, res: Response) {
 *     // ...
 *   }
 */
export const put = (path: string, options?: SwaggerRouteOptions) => {
  return <T extends PutHandler>(target: any, propertyKey: string, descriptor: PropertyDescriptor): TypedPropertyDescriptor<T> => {
    let meta = MetadataStore.get(target, propertyKey);
    if (!meta) {
      meta = { middlewares: [], route: { path, method: "PUT" } };
    }

    meta.documentation = {
      ...(meta.documentation || {}),
      name: propertyKey,
      ...options,
    };

    meta.route = { path, method: "PUT" };
    MetadataStore.set(target, propertyKey, meta);
    return descriptor;
  };
};
