import type { GraphQL } from "../../graphql/graphql.js";
import type { Request } from "../../server/http/request.js";
import { Response } from "../../server/http/response.js";
import type {
  ServerRouteHandler,
  ServerRouteMiddleware,
} from "./server_types.js";

export const executeMiddlewareChain = async (
  middlewares: ServerRouteMiddleware[],
  handler: ServerRouteHandler,
  req: Request,
  res: Response,
): Promise<Response> => {
  const len = middlewares.length;
  if (len === 0) {
    // we handle cases where a direct `return` statement is used in the controller
    const optionalResult = await handler(req, res);
    if (optionalResult) {
      res.send(optionalResult);
      return res;
    }

    return res;
  }

  let index = 0;

  const dispatch = async (): Promise<any> => {
    if (index >= len) {
      // we handle cases where a direct `return` statement is used in the controller
      const optionalResult = await handler(req, res);
      if (optionalResult) {
        res.send(optionalResult);
        return res;
      }

      return res;
    }

    const i = index++;
    const middleware = middlewares[i];
    await middleware(req, res, dispatch);
  };

  await dispatch();
  return res;
};

const METHODS_WITH_BODY = new Set(["post", "put", "patch"]);

export const canHaveBody = (method?: string) => {
  if (!method) {
    return true;
  }

  return METHODS_WITH_BODY.has(method.toLowerCase());
};

/**
 * Execute Apollo Server GraphQL request for Web API compatible runtimes (Bun, Deno)
 * @param apolloServer - The Apollo Server instance
 * @param webRequest - Web API Request object
 * @param method - HTTP method
 * @param search - Query string (with leading ?)
 * @param contextValue - Context value to pass to resolvers
 * @returns Web API Response object
 */
export const executeApolloGraphQLRequestWeb = async (
  apolloServer: import("@apollo/server").ApolloServer<
    import("../../graphql/graphql_types.js").GraphQLContext
  >,
  webRequest: globalThis.Request,
  method: string,
  search: string,
  contextValue: Record<string, unknown>,
): Promise<globalThis.Response> => {
  try {
    const { HeaderMap } = await import("@apollo/server");

    const headers = new HeaderMap();
    webRequest.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    const contentType = webRequest.headers.get("content-type") ?? "";
    const isJsonContent = contentType.includes("application/json");

    let parsedBody: string | Record<string, unknown> = "";
    if (method !== "GET") {
      const bodyText = await webRequest.text();
      parsedBody = isJsonContent && bodyText ? JSON.parse(bodyText) : bodyText;
    }

    const httpGraphQLRequest = {
      method: method.toUpperCase(),
      headers,
      body: parsedBody,
      search: search ? `?${search}` : "",
    };

    const result = await apolloServer.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async () => contextValue,
    });

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of result.headers) {
      responseHeaders[key] = value;
    }

    if (result.body.kind === "complete") {
      return new globalThis.Response(result.body.string, {
        status: result.status ?? 200,
        headers: responseHeaders,
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        if (result.body.kind === "chunked") {
          for await (const chunk of result.body.asyncIterator) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        }
        controller.close();
      },
    });

    return new globalThis.Response(stream, {
      status: result.status ?? 200,
      headers: responseHeaders,
    });
  } catch (error) {
    return new globalThis.Response(
      JSON.stringify({
        errors: [{ message: "Internal server error" }],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

type NodeHeaders = Record<string, string | string[] | undefined>;

/**
 * Execute Apollo Server GraphQL request for Node.js runtime
 * @param apolloServer - The Apollo Server instance
 * @param nodeHeaders - Node.js request headers
 * @param method - HTTP method
 * @param body - Request body string
 * @param search - Query string (with leading ?)
 * @param contextValue - Context value to pass to resolvers
 * @param responseCallback - Callback to handle the response
 */
export const executeApolloGraphQLRequestNode = async (
  apolloServer: import("@apollo/server").ApolloServer<
    import("../../graphql/graphql_types.js").GraphQLContext
  >,
  nodeHeaders: NodeHeaders,
  method: string,
  body: string,
  search: string,
  contextValue: Record<string, unknown>,
  responseCallback: (
    headers: Map<string, string>,
    status: number,
    body: string | AsyncIterable<string>,
  ) => Promise<void>,
): Promise<void> => {
  try {
    const { HeaderMap } = await import("@apollo/server");

    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(nodeHeaders)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
    }

    const contentType = headers.get("content-type") ?? "";
    const isJsonContent = contentType.includes("application/json");

    const parsedBody = isJsonContent && body ? JSON.parse(body) : body;

    const httpGraphQLRequest = {
      method: method?.toUpperCase() ?? "POST",
      headers,
      body: parsedBody,
      search: search ? `?${search}` : "",
    };

    const result = await apolloServer.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async () => contextValue,
    });

    const status = result.status ?? 200;

    if (result.body.kind === "complete") {
      await responseCallback(result.headers, status, result.body.string);
    } else {
      await responseCallback(result.headers, status, result.body.asyncIterator);
    }
  } catch (error) {
    await responseCallback(
      new Map([["Content-Type", "application/json"]]),
      500,
      JSON.stringify({
        errors: [{ message: "Internal server error" }],
      }),
    );
  }
};

/**
 * Create a GraphQL handler initializer with caching
 * Returns a function that lazily loads and initializes the Apollo Server handler
 */
export const createGraphQLHandlerInitializer = (graphql: GraphQL) => {
  let serverPromise: Promise<{
    server: import("@apollo/server").ApolloServer<
      import("../../graphql/graphql_types.js").GraphQLContext
    >;
    url: string;
  }> | null = null;
  let isInitializing = false;

  const waitForInitialization = async (): Promise<void> => {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  const initializeHandler = async (): Promise<{
    server: import("@apollo/server").ApolloServer<
      import("../../graphql/graphql_types.js").GraphQLContext
    >;
    url: string;
  }> => {
    try {
      const { ApolloServer } = await import("@apollo/server");
      const { makeExecutableSchema } = await import("@graphql-tools/schema");

      const schemaOptions = graphql.getSchemaOptions();
      const apolloOptions = graphql.getApolloOptions();

      const schema = makeExecutableSchema({
        typeDefs: schemaOptions.typeDefs,
        resolvers: schemaOptions.resolvers as any,
      });

      const server = new ApolloServer<
        import("../../graphql/graphql_types.js").GraphQLContext
      >({
        schema,
        ...(apolloOptions as any),
      });

      await server.start();

      return {
        server,
        url: "/graphql",
      };
    } catch (error) {
      const isModuleNotFound =
        error instanceof Error &&
        (error.message.includes("Cannot find module") ||
          error.message.includes("Cannot find package"));
      if (isModuleNotFound) {
        throw new Error(
          "GraphQL is enabled but '@apollo/server' is not installed. " +
            "Install it with: npm install @apollo/server @graphql-tools/schema graphql",
        );
      }
      throw error;
    }
  };

  return async (): Promise<{
    server: import("@apollo/server").ApolloServer<
      import("../../graphql/graphql_types.js").GraphQLContext
    >;
    url: string;
  } | null> => {
    const isDisabled = !graphql.isEnabled;
    if (isDisabled) {
      return null;
    }

    const alreadyInitialized = serverPromise !== null;
    if (alreadyInitialized) {
      return serverPromise;
    }

    const currentlyInitializing = isInitializing;
    if (currentlyInitializing) {
      await waitForInitialization();
      return serverPromise;
    }

    isInitializing = true;

    try {
      serverPromise = initializeHandler();
      const result = await serverPromise;
      return result;
    } catch (error) {
      serverPromise = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  };
};
