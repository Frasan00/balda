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
        const customHandler = getPolicyErrorHandler();
        if (customHandler) {
          return customHandler(req, res);
        }
        return res.unauthorized({ error: "Unauthorized" });
      }
    }
    return next();
  };
};
