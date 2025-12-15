import { BaldaError } from "./balda_error.js";

export class MethodNotAllowedError extends BaldaError {
  constructor(path: string, method: string) {
    super(`METHOD_NOT_ALLOWED: Cannot ${method} ${path}`);
  }
}
