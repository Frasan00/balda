import type { createSchema, createYoga } from "graphql-yoga";

export type GraphQLSchemaInput = Parameters<typeof createSchema>[0];

export type GraphQLTypeDef = GraphQLSchemaInput["typeDefs"];

export type GraphQLResolvers = GraphQLSchemaInput["resolvers"];

export interface GraphQLContext {}

export type GraphQLResolverFunction<TContext = GraphQLContext> = (
  parent: unknown,
  args: Record<string, unknown>,
  context: TContext,
  info: unknown,
) => unknown | Promise<unknown>;

export type GraphQLResolverMap<TContext = GraphQLContext> = Record<
  string,
  GraphQLResolverFunction<TContext> | Record<string, unknown>
>;

export type GraphQLOptions = {
  schema?: GraphQLSchemaInput;
  yogaOptions?: Parameters<typeof createYoga>[0];
};

export type GraphQLResolverType = "Query" | "Mutation" | "Subscription";
