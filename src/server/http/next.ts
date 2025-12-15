import type { SyncOrAsync } from "../../type_util.js";

/**
 * The next function.
 * This is the function that is passed to the handler function.
 * It has a pointer to the next middleware or handler function of the middleware chain.
 */
export type NextFunction = () => SyncOrAsync;
