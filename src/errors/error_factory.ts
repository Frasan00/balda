import type { BaldaError } from "src/errors/balda_error";

export const errorFactory = (error: BaldaError) => {
  return {
    cause: error.cause,
    message: error.message,
    stack: error.stack,
  };
};
