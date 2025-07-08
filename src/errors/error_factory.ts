import type { BaldaError } from "src/errors/balda_error";

export const errorFactory = (error: BaldaError) => {
  return {
    name: error.constructor.name,
    cause: error.cause,
    message: error.message,
    stack: error.stack,
  };
};
