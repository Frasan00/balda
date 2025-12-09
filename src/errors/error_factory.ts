import type { BaldaError } from "src/errors/balda_error";
import { NativeEnv } from "src/runtime/native_env";

const nativeEnv = new NativeEnv();

export const errorFactory = (error: BaldaError) => {
  const isDevelopment = nativeEnv.get("NODE_ENV") !== "production";

  return {
    code: error.name || "INTERNAL_ERROR",
    message: error.message,
    ...(isDevelopment && { stack: error.stack, cause: error.cause }),
  };
};
