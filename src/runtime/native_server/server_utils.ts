import type { GraphQL } from "../../graphql/graphql.js";
import type { Request } from "../../server/http/request.js";
import { Response } from "../../server/http/response.js";
import type {
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "./server_types.js";

const isPromise = <T = unknown>(value: unknown): value is Promise<T> => {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as any).then === "function"
  );
};

export const executeMiddlewareChain = async (
  middlewares: ServerRouteMiddleware[],
  handler: ServerRouteHandler,
  req: Request,
  res: Response = new Response(),
): Promise<Response> => {
  let currentIndex = -1;

  const next = async (): Promise<void> => {
    currentIndex++;

    if (currentIndex >= middlewares.length) {
      const result = handler(req, res);
      if (isPromise(result)) {
        await result;
      }
      return;
    }

    const middleware = middlewares[currentIndex];
    const result = middleware(req, res, next);

    if (isPromise(result)) {
      await result;
    }
    // If middleware didn't call next() and didn't return promise, the chain stops here
  };

  // Start the middleware chain
  await next();
  return res;
};

export const canHaveBody = (method?: string) => {
  if (!method) {
    return true;
  }

  return ["post", "put", "patch"].includes(method.toLowerCase());
};

/**
 * Create a GraphQL handler initializer with caching
 * Returns a function that lazily loads and initializes the GraphQL handler
 */
export const createGraphQLHandlerInitializer = (graphql: GraphQL) => {
  let handlerPromise: Promise<
    ReturnType<typeof import("graphql-yoga").createYoga>
  > | null = null;
  let isInitializing = false;

  const waitForInitialization = async (): Promise<void> => {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  const initializeHandler = async (): Promise<
    ReturnType<typeof import("graphql-yoga").createYoga>
  > => {
    try {
      const { createYoga, createSchema } = await import("graphql-yoga");
      const schema = graphql.getSchema(createSchema);
      const yogaOptions = graphql.getYogaOptions();
      return createYoga({
        graphqlEndpoint: "/graphql",
        ...yogaOptions,
        schema,
      });
    } catch (error) {
      const isModuleNotFound =
        error instanceof Error &&
        (error.message.includes("Cannot find module") ||
          error.message.includes("Cannot find package"));
      if (isModuleNotFound) {
        throw new Error(
          "GraphQL is enabled but 'graphql-yoga' is not installed. " +
            "Install it with: npm install graphql graphql-yoga",
        );
      }
      throw error;
    }
  };

  return async (): Promise<ReturnType<
    typeof import("graphql-yoga").createYoga
  > | null> => {
    const isDisabled = !graphql.isEnabled;
    if (isDisabled) {
      return null;
    }

    const alreadyInitialized = handlerPromise !== null;
    if (alreadyInitialized) {
      return handlerPromise;
    }

    const currentlyInitializing = isInitializing;
    if (currentlyInitializing) {
      await waitForInitialization();
      return handlerPromise;
    }

    isInitializing = true;

    try {
      handlerPromise = initializeHandler();
      const handler = await handlerPromise;
      return handler;
    } catch (error) {
      handlerPromise = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  };
};
