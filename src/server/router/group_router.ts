import type { RequestSchema } from "../../decorators/validation/validate_types.js";
import type {
  ControllerHandler,
  StandardMethodOptions,
} from "../server_types.js";
import type {
  TypedMiddleware,
  InferMiddlewareExtensions,
} from "../http/typed_middleware.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";

/**
 * A type-level overlay for Router that carries group-level middleware extensions.
 * Every route handler defined on a GroupRouter automatically receives `TGroupExt`
 * merged into its `req` parameter, composed with any route-level TypedMiddleware extensions.
 *
 * @template TGroupExt - The accumulated middleware extensions from enclosing group(s)
 *
 * @example
 * ```typescript
 * router.group("/api", [auth], (r) => {
 *   // r is GroupRouter<{ userId: number }>
 *   r.get("/profile", (req, res) => {
 *     req.userId; // number — inferred from group middleware
 *   });
 * });
 * ```
 */
export interface GroupRouter<
  TGroupExt extends Record<string, any> = Record<string, never>,
> {
  // --- GET ---
  get<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  get<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- POST ---
  post<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  post<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- PATCH ---
  patch<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  patch<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- PUT ---
  put<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  put<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- DELETE ---
  delete<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  delete<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- OPTIONS ---
  options<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  options<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- HEAD ---
  head<TPath extends string = string>(
    path: TPath,
    handler: ControllerHandler<
      TPath,
      Record<number, RequestSchema>,
      unknown,
      unknown,
      unknown,
      unknown,
      TGroupExt
    >,
  ): void;
  head<
    TPath extends string = string,
    TResponses extends Record<number, RequestSchema> = Record<
      number,
      RequestSchema
    >,
    TBody extends RequestSchema | undefined = undefined,
    TQuery extends RequestSchema | undefined = undefined,
    THeaders extends RequestSchema | undefined = undefined,
    TAll extends RequestSchema | undefined = undefined,
    const TMiddlewares extends readonly TypedMiddleware<any>[] =
      readonly TypedMiddleware<any>[],
  >(
    path: TPath,
    options: StandardMethodOptions<
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TPath,
      TAll,
      TMiddlewares
    >,
    handler: ControllerHandler<
      TPath,
      TResponses,
      TBody,
      TQuery,
      THeaders,
      TAll,
      TGroupExt & InferMiddlewareExtensions<TMiddlewares>
    >,
  ): void;

  // --- GROUP (nestable) ---
  group<
    const TMiddlewares extends readonly (
      | ServerRouteMiddleware
      | TypedMiddleware<any>
    )[] = readonly (ServerRouteMiddleware | TypedMiddleware<any>)[],
  >(
    path: string,
    middleware: TMiddlewares,
    cb: (
      router: GroupRouter<TGroupExt & InferMiddlewareExtensions<TMiddlewares>>,
    ) => void,
  ): void;
  group(path: string, cb: (router: GroupRouter<TGroupExt>) => void): void;
}
