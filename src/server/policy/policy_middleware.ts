import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { PolicyMetadata } from "./policy_types.js";
import { getPolicyErrorHandler } from "./policy_error_handler_registry.js";

/**
 * Creates a middleware that enforces policies before allowing the request to proceed.
 * Returns 401 Unauthorized if any policy check fails (or delegates to the custom
 * policy error handler if one has been registered via `server.setPolicyErrorHandler()`).
 */
export const createPolicyMiddleware = (
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
        const customOptions = getPolicyErrorHandler();
        if (customOptions) {
          const status = customOptions.status ?? 401;
          const body = customOptions.map
            ? await customOptions.map(req)
            : { error: "Unauthorized" };
          return res.status(status).json(body);
        }
        return res.unauthorized({ error: "Unauthorized" });
      }
    }
    return next();
  };
};
