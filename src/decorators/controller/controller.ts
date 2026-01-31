import { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import { nativePath } from "../../runtime/native_path.js";
import { MetadataStore } from "../../metadata_store.js";
import type {
  HttpMethod,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types.js";
import type { PolicyMetadata } from "../../server/policy/policy_types.js";
import { router } from "../../server/router/router.js";

/**
 * Creates a middleware that enforces policies before allowing the request to proceed.
 * Returns 401 Unauthorized if any policy check fails.
 */
const createPolicyMiddleware = (
  policies: PolicyMetadata[],
): ServerRouteMiddleware => {
  return async (req, res, next) => {
    for (const policy of policies) {
      const allowed = await policy.manager.canAccess(
        policy.scope,
        policy.handler,
        req,
      );
      if (!allowed) {
        return res.unauthorized({ error: "Unauthorized" });
      }
    }
    return next();
  };
};

/**
 * Decorator to mark a class as a controller, routes defined in the controller will be registered at import time when calling the `listen` method.
 * You can customize the path pattern for controller imports in the server options `controllerPatterns`
 * @param path - The path pattern for the controller.
 * @param swaggerOptions - The swagger options for the controller that will be applied to all routes defined in the controller. Controller options will override route options.
 * @swagger If swagger is enabled, the default service name for all routes defined in the controller will be the controller name.
 * @swagger For naming commodity, the default service name will remove the "Controller" suffix if it exists. e.g. "UserController" -> "User"
 */
export const controller = (
  path?: string,
  swaggerOptions?: SwaggerRouteOptions,
) => {
  return (target: any) => {
    const classMeta = MetadataStore.get(target.prototype, "__class__");
    const classMiddlewares = classMeta?.middlewares || [];
    const classPolicies: PolicyMetadata[] = classMeta?.policies || [];
    const metaMap = MetadataStore.getAll(target.prototype);
    const instance = new target();

    if (!metaMap) {
      return;
    }

    for (const [propertyKey, meta] of metaMap.entries()) {
      if (!meta.route) {
        continue;
      }

      const handler = target.prototype[propertyKey].bind(instance);
      const fullPath = path
        ? nativePath.join(path, meta.route.path)
        : meta.route.path;

      // Combine class-level and method-level policies
      const allPolicies: PolicyMetadata[] = [
        ...classPolicies,
        ...(meta.policies || []),
      ];

      // Create policy middleware if there are policies to enforce
      const policyMiddleware =
        allPolicies.length > 0 ? [createPolicyMiddleware(allPolicies)] : [];

      if (meta.cache && meta.route.method !== "GET") {
        throw new Error(
          `Cache decorator can only be used on GET routes. Found on ${meta.route.method} ${fullPath} in ${target.name}`,
        );
      }

      // Prepend class-level middlewares, then policy middleware, then route-level middlewares
      const allMiddlewares = [
        ...classMiddlewares,
        ...policyMiddleware,
        ...(meta.middlewares || []),
      ];

      // Build swagger options from controller and method metadata
      const routeSwaggerOptions: SwaggerRouteOptions = {
        // default service name
        service: target.name.replace(/Controller$/, ""),
        // controller options
        ...swaggerOptions,
        // route options
        ...meta.documentation,
      };

      router.addOrUpdate(
        meta.route.method as HttpMethod,
        fullPath,
        allMiddlewares,
        handler,
        undefined, // validationSchemas - handled by @validate decorator wrapper
        routeSwaggerOptions,
        meta.cache, // cache options for GET routes
      );
    }

    MetadataStore.clear(target.prototype);
  };
};
