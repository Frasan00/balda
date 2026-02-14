import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type {
  ExtractParams,
  InferSchemaType,
} from "../../server/router/path_types.js";
import type { RequestSchema } from "../validation/validate_types.js";

/**
 * Type-safe handler for routes with typed path parameters and response
 * Body and query are validated first and passed as separate typed arguments
 * @example
 * TypedHandler<"/users/:id", CreateUserSchema, SearchQuerySchema, { 200: UserResponse }>
 *   → (req: Request<{ id: string }>, res: Response<{ 200: UserResponse }>, body: CreateUserInput, query: SearchQuery) => void | Promise<void>
 */
export type TypedHandler<
  TPath extends string,
  TBody extends RequestSchema | undefined = undefined,
  TQuery extends RequestSchema | undefined = undefined,
  TResponseMap extends Record<number, any> = Record<number, any>,
> = (
  req: Request<ExtractParams<TPath>>,
  res: Response<TResponseMap>,
  ...args: [
    ...(TBody extends RequestSchema ? [body: InferSchemaType<TBody>] : []),
    ...(TQuery extends RequestSchema ? [query: InferSchemaType<TQuery>] : []),
  ]
) => void | Promise<void>;

/**
 * Metadata for typed routes
 * Stores path and extracted parameter types
 */
export interface TypedRouteMetadata<TPath extends string = string> {
  path: TPath;
  params: ExtractParams<TPath>;
}
