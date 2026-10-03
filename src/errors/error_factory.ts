import type { BaldaError } from "./balda_error.js";

// The call sites (body parsers, static plugin, runtime fallbacks) have no Server
// reference, so stack/cause exposure is a process-wide switch set at construction.
let exposeErrorDetails = false;

export function setExposeErrorDetails(value: boolean): void {
  exposeErrorDetails = value;
}

/**
 * Resolves the `exposeErrorDetails` server option to a boolean.
 * `"auto"` reproduces the legacy `NODE_ENV === "development"` behaviour.
 */
export function resolveExposeErrorDetails(
  option: boolean | "auto" | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (option === "auto") {
    return nodeEnv === "development";
  }
  return option ?? false;
}

export const errorFactory = (error: BaldaError) => {
  return {
    code: error.name || "INTERNAL_ERROR",
    message: error.message,
    ...(exposeErrorDetails && { stack: error.stack, cause: error.cause }),
  };
};
