import type {
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "../../runtime/native_server/server_types.js";
import type { SwaggerRouteOptions } from "../../plugins/swagger/swagger_types.js";
import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import type { Router } from "./router.js";

export type Params = Record<string, string>;

/**
 * Stores compiled response schemas for a route, indexed by status code.
 * This enables automatic fast JSON serialization without explicit schema passing.
 */
export type RouteResponseSchemas = Record<number, RequestSchema>;

export interface Route {
  method: string;
  path: string;
  middleware: ServerRouteMiddleware[];
  handler: ServerRouteHandler;
  swaggerOptions?: SwaggerRouteOptions;
  /**
   * Response schemas from route options, indexed by status code.
   * Used by swagger plugin for documentation and fast JSON serialization.
   */
  responses?: RouteResponseSchemas;
  /**
   * Compiled response schemas, indexed by status code.
   * Used for automatic fast JSON serialization in Response.json()
   */
  responseSchemas?: RouteResponseSchemas;
  /**
   * Validation schemas for request body, query parameters, or both.
   * When provided, the handler will receive validated data as additional parameters.
   */
  validationSchemas?: {
    body?: RequestSchema;
    query?: RequestSchema;
    all?: RequestSchema;
  };
}

/**
 * The client router is a subset of the router that is used to define routes on library level by the end user.
 */
export type ClientRouter = Omit<
  Router,
  "applyGlobalMiddlewaresToAllRoutes" | "addOrUpdate"
>;
