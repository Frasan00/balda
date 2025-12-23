import type { ApolloServerOptions, BaseContext } from "@apollo/server";
import type { DocumentNode, GraphQLResolveInfo } from "graphql";

export type GraphQLTypeDef =
  | string
  | DocumentNode
  | string[]
  | DocumentNode[]
  | (() => string | DocumentNode | string[] | DocumentNode[]);

export type GraphQLResolvers =
  | Record<string, unknown>
  | Record<string, unknown>[]
  | unknown;

export interface GraphQLContext extends BaseContext {}

export type GraphQLResolverFunction<TContext = GraphQLContext> = (
  parent: unknown,
  args: Record<string, unknown>,
  context: TContext,
  info: GraphQLResolveInfo,
) => unknown | Promise<unknown>;

export type GraphQLResolverMap<TContext = GraphQLContext> = Record<
  string,
  GraphQLResolverFunction<TContext> | Record<string, unknown>
>;

export type GraphQLSchemaInput = {
  typeDefs: GraphQLTypeDef;
  resolvers?: GraphQLResolvers;
};

export type GraphQLOptions = {
  schema?: GraphQLSchemaInput;
  apolloOptions?: Omit<
    ApolloServerOptions<GraphQLContext>,
    "typeDefs" | "resolvers"
  > & {
    context?:
      | ((arg: any) => GraphQLContext | Promise<GraphQLContext>)
      | GraphQLContext;
  };
};

export type GraphQLResolverType = "Query" | "Mutation" | "Subscription";
