import type { SyncOrAsync } from "../../type_util.js";
import type { NextFunction } from "./next.js";
import type { Request } from "./request.js";
import type { Response } from "./response.js";

/**
 * A middleware that carries type information about the properties it adds to the request.
 * Uses a phantom branded property to flow type info through the type system without runtime cost.
 *
 * @template TExtension - The properties this middleware adds to the request object
 *
 * @example
 * ```typescript
 * const auth = defineMiddleware<{ userId: number }>((req, res, next) => {
 *   req.userId = getUserIdFromToken(req.headers);
 *   return next();
 * });
 *
 * router.get("/profile", { middlewares: [auth] }, (req, res) => {
 *   req.userId; // number — inferred from middleware!
 * });
 * ```
 */
export type TypedMiddleware<
  TExtension extends Record<string, any> = Record<string, never>,
> = ((
  req: Request & TExtension,
  res: Response,
  next: NextFunction,
) => SyncOrAsync) & { readonly __middlewareExtension?: TExtension };

/**
 * Helper to create a typed middleware with correct request typing inside the middleware body.
 * The returned function is branded with the extension type so the router can infer it.
 *
 * @template TExtension - The properties this middleware adds to the request
 * @param fn - The middleware function with typed `req` parameter
 * @returns A branded middleware carrying the extension type
 *
 * @example
 * ```typescript
 * const auth = defineMiddleware<{ userId: number }>((req, res, next) => {
 *   req.userId = 123;
 *   return next();
 * });
 * ```
 */
export function defineMiddleware<TExtension extends Record<string, any>>(
  fn: (
    req: Request & TExtension,
    res: Response,
    next: NextFunction,
  ) => SyncOrAsync,
): TypedMiddleware<TExtension> {
  return fn as TypedMiddleware<TExtension>;
}

/**
 * Extracts the extension type from a single middleware.
 * Returns `{}` for unbranded middlewares (backward compatibility).
 */
export type InferMiddlewareExtension<T> =
  T extends TypedMiddleware<infer E> ? E : {};

/**
 * Combines extension types from a tuple of middlewares into a single intersection type.
 *
 * @example
 * ```typescript
 * type Ext = InferMiddlewareExtensions<[TypedMiddleware<{ userId: number }>, TypedMiddleware<{ role: string }>]>;
 * // { userId: number } & { role: string }
 * ```
 */
export type InferMiddlewareExtensions<T extends readonly any[]> =
  T extends readonly [infer First, ...infer Rest]
    ? InferMiddlewareExtension<First> & InferMiddlewareExtensions<Rest>
    : {};
