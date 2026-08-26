---
title: GraphQL
description: Built-in GraphQL support with Apollo Server integration. Type-safe schemas and resolvers with decorators.
keywords: [balda, graphql, apollo, typesafe, schema, resolvers]
sidebar_position: 1
---

# GraphQL

GraphQL support is built into `balda`, which integrates [Apollo Server](https://www.apollographql.com/docs/apollo-server/). Balda loads Apollo lazily the moment you enable the `graphql` option, so installing `balda` alone never pulls in Apollo.

## Installation

Install the Apollo drivers:

```bash
npm install @apollo/server @graphql-tools/schema graphql
```

or with yarn:

```bash
yarn add @apollo/server @graphql-tools/schema graphql
```

## Basic Setup

Enable GraphQL by passing a `graphql` configuration object when creating your server:

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
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
  },
});

await server.listen();
```

Your GraphQL endpoint will be available at `/graphql` by default.

## Configuration Options

### Schema Configuration

The `schema` option accepts type definitions and resolvers:

```typescript
const server = new Server({
  graphql: {
    schema: {
      typeDefs: `
        type User {
          id: ID!
          name: String!
          email: String!
        }

        type Query {
          users: [User!]!
          user(id: ID!): User
        }

        type Mutation {
          createUser(name: String!, email: String!): User!
        }
      `,
      resolvers: {
        Query: {
          users: () => {
            // Fetch users from database
            return [];
          },
          user: (parent, args) => {
            // Fetch user by ID
            return { id: args.id, name: "John", email: "john@example.com" };
          },
        },
        Mutation: {
          createUser: (parent, args) => {
            // Create user in database
            return { id: "1", name: args.name, email: args.email };
          },
        },
      },
    },
  },
});
```

### Apollo Server Options

You can pass additional options to Apollo Server:

```typescript
const server = new Server({
  graphql: {
    schema: {
      typeDefs: `...`,
      resolvers: {},
    },
    apolloOptions: {
      introspection: true,
      includeStacktraceInErrorResponses: false,
      csrfPrevention: true,
      cache: "bounded",
      plugins: [
        // Add your Apollo Server plugins here
      ],
    },
  },
});
```

For a full list of Apollo Server options, see the [Apollo Server documentation](https://www.apollographql.com/docs/apollo-server/api/apollo-server).

## Dynamic Schema Building

Balda provides methods to add type definitions and resolvers dynamically:

### Adding Type Definitions

Use `addTypeDef()` to add type definitions after server initialization:

```typescript
const server = new Server({ graphql: {} });

// Add type definitions
server.graphql.addTypeDef(`
  type Book {
    id: ID!
    title: String!
    author: String!
  }
`);

server.graphql.addTypeDef(`
  extend type Query {
    books: [Book!]!
    book(id: ID!): Book
  }
`);
```

You can also add multiple type definitions at once:

```typescript
server.graphql.addTypeDef([
  `type Author { id: ID!, name: String! }`,
  `type Publisher { id: ID!, name: String! }`,
]);
```

### Adding Resolvers

Use `addResolver()` to add resolvers dynamically:

```typescript
// Add resolvers for a specific type
server.graphql.addResolver("Query", {
  books: () => {
    return [{ id: "1", title: "GraphQL Basics", author: "John Doe" }];
  },
  book: (parent, args) => {
    return { id: args.id, title: "Book Title", author: "Author" };
  },
});

server.graphql.addResolver("Mutation", {
  createBook: (parent, args) => {
    return { id: "1", title: args.title, author: args.author };
  },
});
```

You can also add full resolver objects:

```typescript
server.graphql.addResolver({
  Query: {
    users: () => [],
  },
  Mutation: {
    createUser: (parent, args) => args,
  },
});
```

For custom types:

```typescript
server.graphql.addResolver("Book", {
  author: (parent) => {
    // Resolve nested author field
    return { id: "1", name: parent.author };
  },
});
```

## Typed Context

Balda exports a `GraphQLContext` interface that you can extend to provide type-safe context in your resolvers.

### Extending the Context

Use TypeScript's module augmentation to extend the context type:

```typescript
import type { GraphQLContext } from "balda";

// Define your custom context properties
interface User {
  id: string;
  name: string;
  email: string;
}

interface Database {
  users: Map<string, User>;
}

// Extend the GraphQLContext interface
declare module "balda" {
  interface GraphQLContext {
    user?: User;
    db: Database;
    req: Request;
  }
}
```

### Using Typed Context in Resolvers

Once extended, your resolvers will have full type safety:

```typescript
server.graphql.addResolver("Query", {
  me: (parent, args, context) => {
    // context.user is now fully typed!
    if (!context.user) {
      throw new Error("Not authenticated");
    }
    return context.user;
  },
  users: (parent, args, context) => {
    // context.db is typed as Database
    return Array.from(context.db.users.values());
  },
});
```

### Providing Context

Context values are automatically provided by Apollo Server. The default context includes the Balda request object. You can extend the context using Apollo Server's context function:

```typescript
const db: Database = {
  users: new Map(),
};

const server = new Server({
  graphql: {
    schema: {
      typeDefs: `...`,
      resolvers: {},
    },
    apolloOptions: {
      context: async ({ req }) => {
        // Extract user from request headers
        const token =
          req.rawHeaders?.get("authorization");
        const user = token ? await verifyToken(token) : undefined;

        return {
          user,
          db,
          req,
        };
      },
    },
  },
});
```

## Resolver Function Signature

All resolver functions follow the standard GraphQL signature:

```typescript
type GraphQLResolverFunction<TContext = GraphQLContext> = (
  parent: unknown,
  args: Record<string, unknown>,
  context: TContext,
  info: GraphQLResolveInfo,
) => unknown | Promise<unknown>;
```

- **parent**: The result of the parent resolver (for nested fields)
- **args**: The arguments provided to the field
- **context**: The shared context object (typed via module augmentation)
- **info**: GraphQL execution info (field name, parent type, schema details, etc.)

Resolvers can return values synchronously or return a Promise for async operations.

## Error Handling

Apollo Server automatically catches errors thrown in resolvers:

```typescript
server.graphql.addResolver("Query", {
  user: async (parent, args, context) => {
    const user = await context.db.users.get(args.id);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
});
```

For custom error handling, use Apollo Server's error formatting options:

```typescript
import { GraphQLError } from "graphql";

const server = new Server({
  graphql: {
    apolloOptions: {
      formatError: (formattedError, error) => {
        // Don't expose internal errors in production
        if (formattedError.message.includes("INTERNAL")) {
          return new GraphQLError("Internal server error", {
            extensions: {
              code: "INTERNAL_SERVER_ERROR",
            },
          });
        }
        return formattedError;
      },
    },
  },
});
```

## Apollo Sandbox

Apollo Server includes a built-in Apollo Sandbox for GraphQL exploration and testing. Access it by navigating to your GraphQL endpoint in a browser:

```
http://localhost:3000/graphql
```

### Enabling Apollo Sandbox

To enable the Apollo Sandbox UI with full introspection support, configure your server with the landing page plugin:

```typescript
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { Server } from "balda";

const server = new Server({
  graphql: {
    schema: {
      typeDefs: `...`,
      resolvers: {},
    },
    apolloOptions: {
      introspection: true, // Required for schema introspection
      csrfPrevention: false, // Disable for local development
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    },
  },
});
```

**Important configuration options:**

- **`introspection: true`** - Enables schema introspection, allowing the Sandbox UI to load your GraphQL schema
- **`csrfPrevention: false`** - Disables CSRF prevention for local development (recommended for development only)
- **`ApolloServerPluginLandingPageLocalDefault()`** - Provides the Apollo Sandbox UI

### Using the Sandbox UI

Once your server is running, navigate to `http://localhost:3000/graphql` in your browser. The Sandbox UI provides:

#### 1. **Interactive Query Editor**

- Auto-completion for types, fields, and arguments
- Syntax highlighting
- Real-time validation
- Multiple tabs for different operations

#### 2. **Schema Explorer**

- Browse your entire GraphQL schema
- View type definitions and relationships
- Search for specific types and fields
- Documentation for each field (from schema descriptions)

#### 3. **Query Variables**

- Test queries with dynamic variables
- JSON editor with syntax validation
- Variable type checking

#### 4. **Request Headers**

- Add custom HTTP headers (authentication, etc.)
- Test authorization and authentication flows

#### 5. **Operation History**

- Access previously executed queries
- Save frequently used operations

#### 6. **Response Viewer**

- Formatted JSON responses
- Error details with stack traces (in development)
- Response timing information

### Example: Testing with Sandbox UI

```typescript
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { Server } from "balda";

const server = new Server({
  port: 3000,
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

        type Mutation {
          createUser(name: String!, email: String!): User!
        }
      `,
      resolvers: {
        Query: {
          user: (parent, args) => ({
            id: args.id,
            name: "John Doe",
            email: "john@example.com",
          }),
          users: () => [
            { id: "1", name: "John Doe", email: "john@example.com" },
            { id: "2", name: "Jane Smith", email: "jane@example.com" },
          ],
        },
        Mutation: {
          createUser: (parent, args) => ({
            id: "3",
            name: args.name,
            email: args.email,
          }),
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

server.listen(({ url }) => {
  console.log(`Server running at ${url}`);
  console.log(`Apollo Sandbox: ${url}/graphql`);
});
```

After starting the server, open `http://localhost:3000/graphql` and try these queries in the Sandbox:

**Query with arguments:**

```graphql
query GetUser($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
  }
}
```

**Variables:**

```json
{
  "userId": "1"
}
```

**Mutation:**

```graphql
mutation CreateUser($name: String!, $email: String!) {
  createUser(name: $name, email: $email) {
    id
    name
    email
  }
}
```

### Production Configuration

For production environments, disable introspection and use a different landing page:

```typescript
const server = new Server({
  graphql: {
    apolloOptions: {
      // Disable introspection in production
      introspection: process.env.NODE_ENV !== "production",

      // Enable CSRF prevention
      csrfPrevention: true,

      // Use production landing page
      plugins:
        process.env.NODE_ENV === "production"
          ? [ApolloServerPluginLandingPageDisabled()]
          : [ApolloServerPluginLandingPageLocalDefault()],
    },
  },
});
```

### Troubleshooting Sandbox Issues

If you see "Schema Introspection Failure" in the Sandbox:

1. **Ensure introspection is enabled:**

   ```typescript
   apolloOptions: {
     introspection: true,
   }
   ```

2. **Disable CSRF prevention for local development:**

   ```typescript
   apolloOptions: {
     csrfPrevention: false,
   }
   ```

3. **Check that the GraphQL endpoint is accessible:**
   - Open the browser console
   - Look for network errors
   - Verify the server is running

4. **Test with a simple curl command:**
   ```bash
   curl -X POST http://localhost:3000/graphql \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ __typename }"}'
   ```

### Alternative: Disable Landing Page

If you don't want the Sandbox UI, you can disable it:

```typescript
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";

const server = new Server({
  graphql: {
    apolloOptions: {
      plugins: [ApolloServerPluginLandingPageDisabled()],
    },
  },
});
```

## Lazy Loading

GraphQL dependencies are loaded lazily when the first GraphQL request is made. This means:

- If GraphQL is not configured, the dependencies are never loaded
- Apollo Server is only started when needed, improving startup performance

If the GraphQL peer dependencies are not installed and GraphQL is enabled, you'll receive a clear error message:

```
GraphQL is enabled but '@apollo/server' is not installed.
Install it with: npm install @apollo/server @graphql-tools/schema graphql
```

## Runtime Support

GraphQL support works across all Balda runtimes:

- ✅ Node.js
- ✅ Bun
- ✅ Deno

The implementation uses dynamic imports to load Apollo Server only when needed, ensuring optimal performance across all platforms.

## Advanced Features

### Plugins

Apollo Server supports a powerful plugin system. You can add plugins for logging, caching, metrics, and more:

```typescript
const server = new Server({
  graphql: {
    apolloOptions: {
      plugins: [
        {
          async requestDidStart() {
            return {
              async willSendResponse({ response }) {
                console.log("Sending response:", response);
              },
            };
          },
        },
      ],
    },
  },
});
```

### Subscriptions

For GraphQL subscriptions support, you can configure Apollo Server with the appropriate transport:

```typescript
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

const server = new Server({
  graphql: {
    schema: {
      typeDefs: `
        type Subscription {
          messageAdded: Message
        }
      `,
      resolvers: {
        Subscription: {
          messageAdded: {
            subscribe: () => pubsub.asyncIterator(["MESSAGE_ADDED"]),
          },
        },
      },
    },
  },
});
```

## Next Steps

- Explore [Apollo Server documentation](https://www.apollographql.com/docs/apollo-server/)
- Learn about [GraphQL schema design](https://graphql.org/learn/schema/)
- Check out [Apollo Server plugins](https://www.apollographql.com/docs/apollo-server/builtin-plugins)
- Read about [GraphQL best practices](https://graphql.org/learn/best-practices/)
