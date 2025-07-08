import { BaldaError } from "src/errors/balda_error";

export class RouteNotFoundError extends BaldaError {
  constructor(path: string, method: string) {
    super(`ROUTE_NOT_FOUND: Cannot ${method} ${path}`);
  }
}
