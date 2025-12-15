import type { BaldaError } from "./balda_error.js";
import { NativeEnv } from "../runtime/native_env.js";

const nativeEnv = new NativeEnv();

export const errorFactory = (error: BaldaError) => {
  const isDevelopment = nativeEnv.get("NODE_ENV") !== "production";

  return {
    code: error.name || "INTERNAL_ERROR",
    message: error.message,
    ...(isDevelopment && { stack: error.stack, cause: error.cause }),
  };
};
