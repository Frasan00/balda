import type { Request } from "../../server/http/request";
import { Response } from "../../server/http/response";
import type { ServerRouteHandler, ServerRouteMiddleware } from "./server_types";

/**
 * Execute a middleware chain
 */
export const executeMiddlewareChain = async (
  middlewares: ServerRouteMiddleware[],
  handler: ServerRouteHandler,
  req: Request,
  res: Response = new Response(),
): Promise<Response> => {
  let currentIndex = 0;
  if (!middlewares.length) {
    await handler(req, res);
    return res;
  }

  const next = async (): Promise<void> => {
    currentIndex++;

    if (currentIndex >= middlewares.length) {
      await handler(req, res);
      return;
    }

    const middleware = middlewares[currentIndex];
    await middleware(req, res, next);
  };

  const firstMiddleware = middlewares[0];
  await firstMiddleware(req, res, next);

  return res;
};

export const canHaveBody = (method?: string) => {
  if (!method) {
    return true;
  }

  return ["post", "put", "patch", "delete"].includes(method.toLowerCase());
};
