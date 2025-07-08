import { BaldaError } from "src/errors/balda_error";

export class MethodNotAllowedError extends BaldaError {
  constructor(path: string, method: string) {
    super(`METHOD_NOT_ALLOWED: Cannot ${method} ${path}`);
  }
}
