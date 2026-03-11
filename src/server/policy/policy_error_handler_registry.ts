import type { Request } from "../http/request.js";
import type { Response } from "../http/response.js";
import type { SyncOrAsync } from "../../type_util.js";

/**
 * Custom handler invoked when a policy check fails.
 * When set, replaces the default `res.unauthorized({ error: "Unauthorized" })` response.
 */
export type PolicyErrorHandler = (req: Request, res: Response) => SyncOrAsync;

let globalPolicyErrorHandler: PolicyErrorHandler | null = null;

/**
 * Register a custom global handler for policy authorization failures.
 * Called by `server.setPolicyErrorHandler()`.
 * @internal
 */
export function setPolicyErrorHandler(handler: PolicyErrorHandler): void {
  globalPolicyErrorHandler = handler;
}

/**
 * Get the current global policy error handler (or null for the default).
 * @internal
 */
export function getPolicyErrorHandler(): PolicyErrorHandler | null {
  return globalPolicyErrorHandler;
}

/**
 * Reset the global policy error handler (for testing).
 * @internal
 */
export function resetPolicyErrorHandler(): void {
  globalPolicyErrorHandler = null;
}
