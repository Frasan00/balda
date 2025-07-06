import type {
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types";
import type { SwaggerRouteOptions } from "src/plugins/swagger/swagger_types";
import type { Router } from "./router";

export type Params = Record<string, string>;

export interface Route {
  method: string;
  path: string;
  middleware: ServerRouteMiddleware[];
  handler: ServerRouteHandler;
  swaggerOptions?: SwaggerRouteOptions;
}

/**
 * The client router is a subset of the router that is used to define routes on library level by the end user.
 */
export type ClientRouter = Omit<Router, "applyGlobalMiddlewaresToAllRoutes">;
