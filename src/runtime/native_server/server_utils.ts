import type { Request } from "../../server/request";
import { Response } from "../../server/response";
import type { ServerRouteHandler, ServerRouteMiddleware } from "./server_types";

/**
 * Execute a middleware chain
 */
export const executeMiddlewareChain = async (
  middlewares: ServerRouteMiddleware[],
  handler: ServerRouteHandler,
  req: Request,
  res: Response = new Response(),
  index: number = 0
): Promise<Response> => {
  if (index >= middlewares.length) {
    await handler(req, res);
    return res;
  }

  const middleware = middlewares[index];
  const next = async () => {
    await executeMiddlewareChain(middlewares, handler, req, res, index + 1);
  };

  await middleware(req, res, next);
  return res;
};

export const canHaveBody = (method?: string) => {
  if (!method) {
    return true;
  }

  return ["post", "put", "patch", "delete"].includes(method.toLowerCase());
};
