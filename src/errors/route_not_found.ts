import { BaldaError } from "./balda_error.js";

export class RouteNotFoundError extends BaldaError {
  constructor(path: string, method: string) {
    super(`ROUTE_NOT_FOUND: Cannot ${method} ${path}`);
  }
}
