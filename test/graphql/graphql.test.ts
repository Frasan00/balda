import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { describe, expect, it } from "vitest";
import type { GraphQLContext } from "../../src/graphql/graphql.js";
import type { Request } from "../../src/server/http/request.js";
import { Server } from "../../src/server/server.js";

declare module "../../src/graphql/graphql.js" {
  interface GraphQLContext {
    req?: Request;
    userId?: string;
    userName?: string;
  }
}

describe("GraphQL Integration", () => {
  it("should handle POST requests with introspection query", async () => {
    const server = new Server({
      port: 3001,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello from GraphQL!",
            },
          },
        },
        apolloOptions: {
          introspection: true,
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const introspectionQuery = {
      query: `
        {
          __schema {
            queryType {
              name
            }
          }
        }
      `,
    };

    const res = await mockServer.post("/graphql", {
      body: introspectionQuery,
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data).toBeDefined();
    expect(body.data.__schema.queryType.name).toBe("Query");
  });

  it("should execute simple GraphQL queries", async () => {
    const server = new Server({
      port: 3002,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
              greeting(name: String!): String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello from GraphQL!",
              greeting: (_parent: unknown, args: { name: string }) =>
                `Hello, ${args.name}!`,
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ hello }",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.hello).toBe("Hello from GraphQL!");
  });

  it("should handle GraphQL queries with arguments", async () => {
    const server = new Server({
      port: 3003,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              greeting(name: String!): String
            }
          `,
          resolvers: {
            Query: {
              greeting: (_parent: unknown, args: { name: string }) =>
                `Hello, ${args.name}!`,
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "query($name: String!) { greeting(name: $name) }",
        variables: { name: "World" },
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.greeting).toBe("Hello, World!");
  });

  it("should handle complex types and nested resolvers", async () => {
    const server = new Server({
      port: 3004,
      graphql: {
        schema: {
          typeDefs: `
            type User {
              id: ID!
              name: String!
              email: String!
            }

            type Query {
              user(id: ID!): User
              users: [User!]!
            }
          `,
          resolvers: {
            Query: {
              user: (_parent: unknown, args: { id: string }) => ({
                id: args.id,
                name: "John Doe",
                email: "john@example.com",
              }),
              users: () => [
                { id: "1", name: "John Doe", email: "john@example.com" },
                { id: "2", name: "Jane Smith", email: "jane@example.com" },
              ],
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: `
          {
            user(id: "1") {
              id
              name
              email
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.user.id).toBe("1");
    expect(body.data.user.name).toBe("John Doe");
    expect(body.data.user.email).toBe("john@example.com");
  });

  it("should handle mutations", async () => {
    const users = new Map([
      ["1", { id: "1", name: "John Doe", email: "john@example.com" }],
    ]);

    const server = new Server({
      port: 3005,
      graphql: {
        schema: {
          typeDefs: `
            type User {
              id: ID!
              name: String!
              email: String!
            }

            type Mutation {
              createUser(name: String!, email: String!): User!
              updateUser(id: ID!, name: String!): User
            }

            type Query {
              user(id: ID!): User
            }
          `,
          resolvers: {
            Query: {
              user: (_parent: unknown, args: { id: string }) =>
                users.get(args.id),
            },
            Mutation: {
              createUser: (
                _parent: unknown,
                args: { name: string; email: string },
              ) => {
                const id = String(users.size + 1);
                const user = { id, name: args.name, email: args.email };
                users.set(id, user);
                return user;
              },
              updateUser: (
                _parent: unknown,
                args: { id: string; name: string },
              ) => {
                const user = users.get(args.id);
                if (user) {
                  user.name = args.name;
                  return user;
                }
                return null;
              },
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: `
          mutation {
            createUser(name: "Jane Smith", email: "jane@example.com") {
              id
              name
              email
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.createUser.name).toBe("Jane Smith");
    expect(body.data.createUser.email).toBe("jane@example.com");
  });

  it("should handle GraphQL errors properly", async () => {
    const server = new Server({
      port: 3006,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              failingQuery: String
            }
          `,
          resolvers: {
            Query: {
              failingQuery: () => {
                throw new Error("This query intentionally fails");
              },
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ failingQuery }",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.errors).toBeDefined();
    expect(body.errors[0].message).toBe("This query intentionally fails");
  });

  it("should support GET requests for queries", async () => {
    const server = new Server({
      port: 3007,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello via GET!",
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.get("/graphql", {
      query: {
        query: "{ hello }",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.hello).toBe("Hello via GET!");
  });

  it("should dynamically add type definitions", async () => {
    const server = new Server({
      port: 3008,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello!",
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    server.graphql.addTypeDef(`
      type Book {
        id: ID!
        title: String!
      }

      extend type Query {
        books: [Book!]!
      }
    `);

    server.graphql.addResolver("Query", {
      books: (): Array<{ id: string; title: string }> => [
        { id: "1", title: "GraphQL Basics" },
        { id: "2", title: "Apollo Server Guide" },
      ],
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: `
          {
            books {
              id
              title
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.books).toHaveLength(2);
    expect(body.data.books[0].title).toBe("GraphQL Basics");
  });

  it("should work with Apollo Sandbox landing page plugin", async () => {
    const server = new Server({
      port: 3009,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello!",
            },
          },
        },
        apolloOptions: {
          introspection: true,
          csrfPrevention: false,
          plugins: [ApolloServerPluginLandingPageLocalDefault()],
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ hello }",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.hello).toBe("Hello!");
  });

  it("should handle context in resolvers", async () => {
    const server = new Server({
      port: 3010,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              me: User
            }

            type User {
              id: ID!
              name: String!
            }
          `,
          resolvers: {
            Query: {
              me: (
                _parent: unknown,
                _args: unknown,
                context: GraphQLContext,
              ) => {
                const req = context.req;
                if (req?.headers?.get?.("x-user-id")) {
                  return {
                    id: req.headers.get("x-user-id"),
                    name: req.headers.get("x-user-name") || "Unknown",
                  };
                }
                return null;
              },
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ me { id name } }",
      },
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "123",
        "x-user-name": "John Doe",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.me.id).toBe("123");
    expect(body.data.me.name).toBe("John Doe");
  });

  it("should support typed context with module augmentation", async () => {
    const server = new Server({
      port: 3012,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              currentUser: User
            }

            type User {
              id: ID!
              name: String!
            }
          `,
          resolvers: {
            Query: {
              currentUser: (
                _parent: unknown,
                _args: unknown,
                context: GraphQLContext,
              ) => {
                if (context.userId && context.userName) {
                  return {
                    id: context.userId,
                    name: context.userName,
                  };
                }
                return null;
              },
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
          context: async ({ req }: { req: Request }) => ({
            req,
            userId: req?.headers?.get?.("x-user-id") || undefined,
            userName: req?.headers?.get?.("x-user-name") || undefined,
          }),
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ currentUser { id name } }",
      },
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "456",
        "x-user-name": "Jane Doe",
      },
    });

    expect(res.statusCode()).toBe(200);
    const body = res.body() as any;
    expect(body.data.currentUser.id).toBe("456");
    expect(body.data.currentUser.name).toBe("Jane Doe");
  });

  it("should reject invalid GraphQL syntax", async () => {
    const server = new Server({
      port: 3011,
      graphql: {
        schema: {
          typeDefs: `
            type Query {
              hello: String
            }
          `,
          resolvers: {
            Query: {
              hello: () => "Hello!",
            },
          },
        },
        apolloOptions: {
          csrfPrevention: false,
        },
      },
    });

    const mockServer = await server.getMockServer();

    const res = await mockServer.post("/graphql", {
      body: {
        query: "{ hello invalid syntax }",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(res.statusCode()).toBe(400);
    const body = res.body() as any;
    expect(body.errors).toBeDefined();
  });
});
